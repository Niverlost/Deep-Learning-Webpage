// ============================================================
// Deep Learning Explorer - Auth Module
// 用户认证（注册、登录、密码哈希、会话管理）
// ============================================================

// ==================== 安全配置 ====================

const AUTH_CONFIG = {
  PBKDF2_ITERATIONS: 310000,
  SALT_LENGTH: 32,
  HASH_LENGTH: 32,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  REMEMBER_ME_DAYS: 30,
  TOKEN_LENGTH: 32
};

// ==================== 权限系统 ====================

const PERMISSIONS = {
  guest: { browse: true, visualize: true, code: true, favorite: false, compare: false, admin: false, edit: false },
  user:  { browse: true, visualize: true, code: true, favorite: true, compare: true, admin: false, edit: false },
  admin: { browse: true, visualize: true, code: true, favorite: true, compare: true, admin: true, edit: true }
};

const userState = {
  role: 'guest',
  username: '',
  email: '',
  favorites: [],
  joinDate: null,
  lastActivity: null,
  rememberMe: false
};

function hasPermission(action) {
  return PERMISSIONS[userState.role]?.[action] || false;
}

function requireLogin(callback) {
  if (userState.role === 'guest') {
    showLoginModal(callback);
    return;
  }
  callback();
}

function requirePermission(action, callback) {
  if (!hasPermission(action)) {
    if (userState.role === 'guest') {
      showLoginModal(() => {
        if (hasPermission(action)) {
          callback();
        } else {
          showToast('您没有权限执行此操作', 'error');
        }
      });
      return;
    }
    showToast('您没有权限执行此操作', 'error');
    return;
  }
  callback();
}

// ==================== 用户数据库 ====================

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.USERS_KEY) || '[]');
  } catch (e) {
    console.warn('Failed to parse users data:', e);
    return [];
  }
}

function saveUsers(users) {
  safeSetItem(CONFIG.USERS_KEY, JSON.stringify(users));
}

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: '密码至少需要8个字符' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个大写字母' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个小写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个数字' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: '密码建议包含特殊字符' };
  }
  return { valid: true, message: '' };
}

// ==================== 登录失败限制系统 ====================

function getLoginAttempts() {
  try {
    const data = localStorage.getItem(CONFIG.USERS_KEY + '_attempts');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function saveLoginAttempts(attempts) {
  safeSetItem(CONFIG.USERS_KEY + '_attempts', JSON.stringify(attempts));
}

function recordFailedAttempt(username) {
  const attempts = getLoginAttempts();
  const now = Date.now();
  const userAttempts = attempts[username] || { count: 0, lockUntil: 0 };

  userAttempts.count++;
  userAttempts.lastAttempt = now;

  if (userAttempts.count >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
    userAttempts.lockUntil = now + AUTH_CONFIG.LOCKOUT_DURATION_MS;
    userAttempts.count = 0;
  }

  attempts[username] = userAttempts;
  saveLoginAttempts(attempts);
}

function clearFailedAttempts(username) {
  const attempts = getLoginAttempts();
  delete attempts[username];
  saveLoginAttempts(attempts);
}

function isAccountLocked(username) {
  const attempts = getLoginAttempts();
  const userAttempts = attempts[username];
  if (!userAttempts) return false;

  const now = Date.now();
  if (userAttempts.lockUntil > now) {
    const remainingMinutes = Math.ceil((userAttempts.lockUntil - now) / 60000);
    return { locked: true, remainingMinutes };
  }

  if (userAttempts.count >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
    clearFailedAttempts(username);
  }

  return { locked: false };
}

function getRemainingAttempts(username) {
  const attempts = getLoginAttempts();
  const userAttempts = attempts[username];
  if (!userAttempts) return AUTH_CONFIG.MAX_LOGIN_ATTEMPTS;
  return Math.max(0, AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - userAttempts.count);
}

// ==================== 密码哈希（PBKDF2 优化版） ====================

async function hashPassword(password, salt) {
  if (!crypto.subtle) {
    console.warn('[hashPassword] crypto.subtle 不可用，使用降级哈希方案');
    return hashPasswordLegacy(password, salt);
  }

  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = hexToBuffer(salt);

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: AUTH_CONFIG.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      AUTH_CONFIG.HASH_LENGTH * 8
    );

    return 'v3:' + bufferToHex(derivedBits);
  } catch (e) {
    console.error('[hashPassword] PBKDF2 哈希失败:', e);
    throw new Error('密码哈希处理失败');
  }
}

function hashPasswordLegacy(password, salt) {
  let hash = 0;
  const str = password + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'legacy:' + Math.abs(hash).toString(16).padStart(16, '0') + salt.slice(0, 16);
}

async function verifyPassword(password, storedHash, salt) {
  const inputHash = await hashPassword(password, salt);

  if (inputHash.startsWith('v3:') && storedHash.startsWith('v3:')) {
    return inputHash === storedHash;
  }

  if (inputHash.startsWith('v2:') && storedHash.startsWith('v2:')) {
    return inputHash.slice(3) === storedHash.slice(3);
  }

  return inputHash === storedHash;
}

function generateSalt() {
  try {
    return Array.from(crypto.getRandomValues(new Uint8Array(AUTH_CONFIG.SALT_LENGTH)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error('[generateSalt] 生成随机盐值失败:', e);
    throw new Error('无法生成安全的随机盐值');
  }
}

// ==================== 会话管理 ====================

let sessionCheckInterval = null;
let activityCheckInterval = null;

function startSessionManagement() {
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);
  if (activityCheckInterval) clearInterval(activityCheckInterval);

  sessionCheckInterval = setInterval(() => {
    if (userState.role !== 'guest') {
      const now = Date.now();
      const lastActivity = userState.lastActivity || 0;

      if (now - lastActivity > AUTH_CONFIG.SESSION_TIMEOUT_MS) {
        console.log('[Auth] 会话超时，自动退出');
        logoutUser(true);
        showToast('登录已过期，请重新登录', 'info');
      }
    }
  }, 60000);

  activityCheckInterval = setInterval(() => {
    if (userState.role !== 'guest') {
      updateLastActivity();
    }
  }, 300000);
}

function updateLastActivity() {
  userState.lastActivity = Date.now();
  if (userState.rememberMe) {
    const sessionData = {
      ...userState,
      stored: true
    };
    sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
  }
}

function restoreSession() {
  try {
    const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (session) {
      try {
        const data = JSON.parse(session);
        Object.assign(userState, data);

        if (userState.role === 'admin') {
          state.isAdmin = true;
        }

        const now = Date.now();
        const lastActivity = userState.lastActivity || 0;

        if (now - lastActivity > AUTH_CONFIG.SESSION_TIMEOUT_MS && !userState.rememberMe) {
          logoutUser(true);
          return;
        }

        updateLastActivity();
      } catch (e) {
        console.warn('会话数据解析失败');
      }
    }
  } catch (e) {
    console.warn('sessionStorage 不可用:', e);
  }
  updateUIForRole();
}

function saveUserState() {
  const users = getUsers();
  const user = users.find(u => u.username === userState.username);
  if (user) {
    user.favorites = userState.favorites;
    saveUsers(users);
  }

  const sessionData = {
    ...userState,
    stored: true
  };
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
}

// ==================== 记住我功能 ====================

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(AUTH_CONFIG.TOKEN_LENGTH)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function saveRememberToken(username, token) {
  const tokens = JSON.parse(localStorage.getItem(CONFIG.USERS_KEY + '_tokens') || '{}');
  const expiry = Date.now() + AUTH_CONFIG.REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;
  tokens[username] = { token, expiry };
  safeSetItem(CONFIG.USERS_KEY + '_tokens', JSON.stringify(tokens));
}

function getRememberToken(username) {
  try {
    const tokens = JSON.parse(localStorage.getItem(CONFIG.USERS_KEY + '_tokens') || '{}');
    const tokenData = tokens[username];
    if (!tokenData) return null;

    if (Date.now() > tokenData.expiry) {
      delete tokens[username];
      safeSetItem(CONFIG.USERS_KEY + '_tokens', JSON.stringify(tokens));
      return null;
    }

    return tokenData.token;
  } catch (e) {
    return null;
  }
}

function clearRememberToken(username) {
  const tokens = JSON.parse(localStorage.getItem(CONFIG.USERS_KEY + '_tokens') || '{}');
  delete tokens[username];
  safeSetItem(CONFIG.USERS_KEY + '_tokens', JSON.stringify(tokens));
}

async function autoLoginWithToken() {
  const savedUsername = localStorage.getItem(CONFIG.USERS_KEY + '_remember');
  if (!savedUsername) return false;

  const users = getUsers();
  const user = users.find(u => u.username === savedUsername);
  if (!user) return false;

  const token = getRememberToken(savedUsername);
  if (!token) return false;

  const userTokenData = user.rememberTokens?.find(rt => rt.token === token);
  if (!userTokenData) return false;

  if (Date.now() > userTokenData.expiry) return false;

  userState.role = user.role;
  userState.username = user.username;
  userState.email = user.email;
  userState.favorites = user.favorites || [];
  userState.joinDate = user.joinDate;
  userState.rememberMe = true;
  userState.lastActivity = Date.now();
  state.isAdmin = user.role === 'admin';

  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
  updateUIForRole();
  showToast(`欢迎回来，${user.username}`, 'success');
  return true;
}

async function enableRememberMe(username) {
  const users = getUsers();
  const user = users.find(u => u.username === username);
  if (!user) return;

  const token = generateToken();
  const expiry = Date.now() + AUTH_CONFIG.REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;

  if (!user.rememberTokens) user.rememberTokens = [];
  user.rememberTokens = user.rememberTokens.filter(rt => Date.now() < rt.expiry);
  user.rememberTokens.push({ token, expiry });
  if (user.rememberTokens.length > 5) {
    user.rememberTokens = user.rememberTokens.slice(-5);
  }

  saveUsers(users);
  saveRememberToken(username, token);
  localStorage.setItem(CONFIG.USERS_KEY + '_remember', username);
}

// ==================== 管理员功能 ====================

async function verifyAdminLogin(username, password) {
  if (username !== 'admin') return false;

  const lockStatus = isAccountLocked('admin');
  if (lockStatus.locked) {
    showToast(`管理员账户已锁定，请在 ${lockStatus.remainingMinutes} 分钟后重试`, 'error');
    return false;
  }

  const adminPasswordHash = localStorage.getItem('admin_pass_hash');
  const adminSalt = localStorage.getItem('admin_salt');

  if (!adminPasswordHash || !adminSalt) {
    await initAdminPassword();
    showToast('管理员密码已初始化，请在本地服务器控制台查看密码', 'info');
    return false;
  }

  const inputHash = await hashPassword(password, adminSalt);
  const storedHash = adminPasswordHash.startsWith('v3:') ? adminPasswordHash : 'v2:' + adminPasswordHash;

  if (inputHash !== storedHash) {
    recordFailedAttempt('admin');
    const remaining = getRemainingAttempts('admin');
    if (remaining > 0 && remaining <= 3) {
      showToast(`密码错误，剩余 ${remaining} 次尝试机会`, 'error');
    }
    return false;
  }

  clearFailedAttempts('admin');

  userState.role = 'admin';
  userState.username = 'admin';
  userState.email = '';
  userState.favorites = [];
  userState.joinDate = null;
  userState.rememberMe = false;
  userState.lastActivity = Date.now();
  state.isAdmin = true;

  sessionStorage.setItem(CONFIG.AUTH_KEY, '1');
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
  updateUIForRole();
  showToast('管理员登录成功', 'success');
  return true;
}

async function verifyUserPassword(user, password) {
  const storedPassword = user.password || '';

  let isV3 = storedPassword.startsWith('v3:');
  let isV2 = storedPassword.startsWith('v2:');
  const actualHash = isV3 ? storedPassword.slice(3) : (isV2 ? storedPassword.slice(3) : storedPassword);

  const salt = user.salt || '';

  if ((isV3 || isV2) && salt.length >= 64) {
    const inputHash = await hashPassword(password, salt);
    const passwordValid = inputHash === storedPassword;

    return { passwordValid, needsUpgrade: false };
  }

  const inputHash = await hashPassword(password, salt);
  let passwordValid = false;

  if (isV3) {
    passwordValid = inputHash === storedPassword;
  } else if (isV2) {
    passwordValid = inputHash.slice(3) === actualHash;
  }

  if (!passwordValid && user.password === btoa(password)) {
    passwordValid = true;
  }

  return { passwordValid, needsUpgrade: true };
}

async function upgradePasswordHash(user, password, users) {
  const salt = generateSalt();
  user.salt = salt;
  user.password = await hashPassword(password, salt);
  saveUsers(users);
}

async function setAdminPassword(newPassword) {
  if (!state.isAdmin || userState.role !== 'admin') {
    showToast('需要管理员权限', 'error');
    return false;
  }

  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);
  safeSetItem('admin_pass_hash', hash);
  safeSetItem('admin_salt', salt);
  showToast('管理员密码已更新', 'success');
  return true;
}

function initAdminPassword() {
  try {
    const adminPasswordHash = localStorage.getItem('admin_pass_hash');
    if (!adminPasswordHash) {
      const defaultPassword = 'admin' + Math.random().toString(36).substring(2, 10);
      const salt = generateSalt();

      hashPassword(defaultPassword, salt).then(hash => {
        safeSetItem('admin_pass_hash', hash);
        safeSetItem('admin_salt', salt);

        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          console.log('%c[Admin] 默认管理员密码已生成:', 'color: #007AFF; font-weight: bold;', defaultPassword);
          console.log('%c请在生产环境首次登录后立即修改密码!', 'color: #FF3B30; font-weight: bold;');
        }
      }).catch(e => {
        console.warn('[Admin] 密码哈希生成失败:', e);
      });
    }
  } catch (e) {
    console.warn('[Admin] 管理员密码初始化失败:', e);
  }
}

// ==================== 用户注册与登录 ====================

async function registerUser(username, email, password) {
  const users = getUsers();

  if (users.find(u => u.username === username)) {
    showToast('用户名已存在', 'error');
    return false;
  }
  if (users.find(u => u.email === email)) {
    showToast('该邮箱已被注册', 'error');
    return false;
  }

  const strengthCheck = validatePasswordStrength(password);
  if (!strengthCheck.valid) {
    showToast(strengthCheck.message, 'error');
    return false;
  }

  const salt = generateSalt();
  const hashedPassword = await hashPassword(password, salt);

  users.push({
    username,
    email,
    password: hashedPassword,
    salt: salt,
    role: 'user',
    favorites: [],
    joinDate: new Date().toISOString(),
    rememberTokens: []
  });

  saveUsers(users);
  return true;
}

async function loginUser(username, password, rememberMe = false) {
  const lockStatus = isAccountLocked(username);
  if (lockStatus.locked) {
    showToast(`账户已锁定，请在 ${lockStatus.remainingMinutes} 分钟后重试`, 'error');
    return false;
  }

  const isAdmin = await verifyAdminLogin(username, password);
  if (isAdmin) {
    if (rememberMe) {
      await enableRememberMe('admin');
      userState.rememberMe = true;
    }
    return true;
  }

  const users = getUsers();
  const user = users.find(u => u.username === username);

  if (!user) {
    recordFailedAttempt(username);
    const remaining = getRemainingAttempts(username);
    if (remaining > 0 && remaining <= 3) {
      showToast(`用户名或密码错误，剩余 ${remaining} 次尝试机会`, 'error');
    } else {
      showToast('用户名或密码错误', 'error');
    }
    return false;
  }

  const { passwordValid, needsUpgrade } = await verifyUserPassword(user, password);

  if (!passwordValid) {
    recordFailedAttempt(username);
    const remaining = getRemainingAttempts(username);
    if (remaining > 0 && remaining <= 3) {
      showToast(`密码错误，剩余 ${remaining} 次尝试机会`, 'error');
    } else {
      showToast('用户名或密码错误', 'error');
    }
    return false;
  }

  clearFailedAttempts(username);

  if (needsUpgrade) {
    await upgradePasswordHash(user, password, users);
  }

  if (rememberMe) {
    await enableRememberMe(username);
  } else {
    clearRememberToken(username);
    localStorage.removeItem(CONFIG.USERS_KEY + '_remember');
  }

  userState.role = user.role;
  userState.username = user.username;
  userState.email = user.email;
  userState.favorites = user.favorites || [];
  userState.joinDate = user.joinDate;
  userState.rememberMe = rememberMe;
  userState.lastActivity = Date.now();
  state.isAdmin = user.role === 'admin';

  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
  updateUIForRole();
  showToast(`欢迎回来，${user.username}`, 'success');
  return true;
}

function logoutUser(silent = false) {
  if (!silent && userState.rememberMe) {
    clearRememberToken(userState.username);
  }

  userState.role = 'guest';
  userState.username = '';
  userState.email = '';
  userState.favorites = [];
  userState.joinDate = null;
  userState.rememberMe = false;
  userState.lastActivity = null;
  state.isAdmin = false;

  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(CONFIG.AUTH_KEY);

  updateUIForRole();

  if (!silent) {
    showToast('已退出登录', 'info');
  }
}

// ==================== UI 更新 ====================

function updateUserNav() {
  const userNav = document.getElementById('userNav');
  if (!userNav) return;

  if (userState.role !== 'guest') {
    userNav.style.display = 'flex';
    const avatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    if (avatar) avatar.textContent = userState.username.charAt(0).toUpperCase();
    if (userName) userName.textContent = userState.username;
  } else {
    userNav.style.display = 'none';
  }
}

function updateNavButtons() {
  const loginBtn = document.getElementById('navLoginBtn');
  const adminBtn = document.getElementById('navAdminBtn');
  const favBtn = document.getElementById('navFavBtn');

  if (loginBtn) {
    loginBtn.style.display = userState.role === 'guest' ? 'flex' : 'none';
  }

  if (adminBtn) {
    adminBtn.style.display = hasPermission('admin') ? 'flex' : 'none';
  }

  if (favBtn) {
    favBtn.style.display = hasPermission('favorite') ? 'flex' : 'none';
  }
}

function updateUIForRole() {
  updateUserNav();
  updateNavButtons();
  updateFavoriteButtons();
}

// ==================== 收藏功能 ====================

const favoriteLocks = new Set();
const favoriteSubscribers = new Set();

function subscribeToFavorites(callback) {
  favoriteSubscribers.add(callback);
  return () => favoriteSubscribers.delete(callback);
}

function notifyFavoriteSubscribers(modelName, isFav) {
  favoriteSubscribers.forEach(cb => {
    try {
      cb(modelName, isFav);
    } catch (e) {
      console.warn('收藏订阅者回调失败:', e);
    }
  });
}

function toggleFavorite(modelName) {
  if (favoriteLocks.has(modelName)) return;
  favoriteLocks.add(modelName);

  requireLogin(() => {
    const idx = userState.favorites.indexOf(modelName);
    const isFav = idx === -1;
    if (isFav) {
      userState.favorites.push(modelName);
      showToast('已收藏', 'success');
    } else {
      userState.favorites.splice(idx, 1);
      showToast('已取消收藏', 'info');
    }
    saveUserState();
    updateFavoriteButtons();
    notifyFavoriteSubscribers(modelName, isFav);
  });

  setTimeout(() => favoriteLocks.delete(modelName), 300);
}

function updateFavoriteButtons() {
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const name = btn.dataset.modelName;
    const isFav = userState.favorites.includes(name);
    if (isFav) {
      btn.classList.add('active');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    }
    btn.setAttribute('aria-pressed', isFav);
    btn.setAttribute('aria-label', isFav ? '取消收藏' : '收藏');
  });
}

// ==================== 登录/注册模态框 ====================

function showLoginModal(callback) {
  state.pendingLoginCallback = callback || null;
  switchAuthTab('login');
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.reset();
  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.reset();
  const loginErr = document.getElementById('loginFormError');
  if (loginErr) { loginErr.textContent = ''; loginErr.style.display = 'none'; }
  const regErr = document.getElementById('registerFormError');
  if (regErr) { regErr.textContent = ''; regErr.style.display = 'none'; }
  openModal('loginModal');
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById('authTabLogin');
  const regTab = document.getElementById('authTabRegister');
  const loginPanel = document.getElementById('loginPanel');
  const regPanel = document.getElementById('registerPanel');
  const indicator = document.getElementById('authTabIndicator');

  if (tab === 'login') {
    if (loginTab) { loginTab.classList.add('active'); loginTab.setAttribute('aria-selected', 'true'); }
    if (regTab) { regTab.classList.remove('active'); regTab.setAttribute('aria-selected', 'false'); }
    if (loginPanel) loginPanel.style.display = 'block';
    if (regPanel) regPanel.style.display = 'none';
    if (indicator) indicator.style.left = '0';
  } else {
    if (loginTab) { loginTab.classList.remove('active'); loginTab.setAttribute('aria-selected', 'false'); }
    if (regTab) { regTab.classList.add('active'); regTab.setAttribute('aria-selected', 'true'); }
    if (loginPanel) loginPanel.style.display = 'none';
    if (regPanel) regPanel.style.display = 'block';
    if (indicator) indicator.style.left = '50%';
  }
}

function showFormError(errorEl, message) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const rememberEl = document.getElementById('loginRemember');
  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  const rememberMe = rememberEl ? rememberEl.checked : false;
  const errorEl = document.getElementById('loginFormError');

  if (!username || !password) {
    showFormError(errorEl, '请填写用户名和密码');
    return;
  }

  const success = await loginUser(username, password, rememberMe);
  if (success) {
    closeModal('loginModal');
    if (state.pendingLoginCallback) {
      const cb = state.pendingLoginCallback;
      state.pendingLoginCallback = null;
      setTimeout(cb, 100);
    }
  }
}

function validateRegisterForm(username, email, password, confirmPassword, errorEl) {
  if (!username || username.length < 3 || username.length > 20) {
    showFormError(errorEl, '用户名需要3-20个字符');
    return false;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showFormError(errorEl, '用户名只能包含字母、数字和下划线');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showFormError(errorEl, '请输入有效的邮箱地址');
    return false;
  }

  const strengthCheck = validatePasswordStrength(password);
  if (!strengthCheck.valid) {
    showFormError(errorEl, strengthCheck.message);
    return false;
  }

  if (password !== confirmPassword) {
    showFormError(errorEl, '两次输入的密码不一致');
    return false;
  }

  return true;
}

async function handleRegister(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const errorEl = document.getElementById('registerFormError');

  if (!validateRegisterForm(username, email, password, confirmPassword, errorEl)) {
    return;
  }

  const success = await registerUser(username, email, password);
  if (success) {
    showToast('注册成功，请登录', 'success');
    switchAuthTab('login');
    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) loginUsername.value = username;
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.focus();
  }
}

function checkPasswordStrength(password) {
  const indicator = document.getElementById('passwordStrength');
  if (!indicator) return;

  if (!password) {
    indicator.style.width = '0%';
    indicator.textContent = '';
    return;
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  let strength = '弱';
  let color = '#ef4444';
  let width = '33%';

  if (score >= 6) {
    strength = '强';
    color = '#22c55e';
    width = '100%';
  } else if (score >= 4) {
    strength = '中';
    color = '#f59e0b';
    width = '66%';
  }

  indicator.style.width = width;
  indicator.style.background = color;
  indicator.textContent = strength;
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  const btn = document.querySelector('.user-avatar-btn');
  if (menu) {
    const isOpen = menu.classList.toggle('active');
    if (btn) btn.setAttribute('aria-expanded', isOpen);
  }
}

function logoutAdmin() {
  logoutUser();
  navigate('home');
}

function checkAuth() {
  restoreSession();
}

document.addEventListener('click', function (e) {
  const userNav = document.getElementById('userNav');
  const menu = document.getElementById('userMenu');
  const btn = document.querySelector('.user-avatar-btn');
  if (userNav && menu && !userNav.contains(e.target)) {
    menu.classList.remove('active');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('mousemove', function() {
  if (userState.role !== 'guest') {
    updateLastActivity();
  }
}, { passive: true });

document.addEventListener('keydown', function() {
  if (userState.role !== 'guest') {
    updateLastActivity();
  }
}, { passive: true });
