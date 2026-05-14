// ============================================================
// Deep Learning Explorer - Auth Module
// 用户认证（注册、登录、密码哈希、会话管理）
// ============================================================

import { CONFIG, safeSetItem, generateSalt, hashPassword, escapeHtml } from './utils.js';
import { state } from './state.js';
import { showToast } from './ui-components.js';
import { openModal, closeModal } from './ui-components.js';
import { navigate } from './router.js';

// ==================== 权限系统 ====================

/**
 * 权限配置
 * @type {Object}
 */
export const PERMISSIONS = {
  guest: { browse: true, visualize: true, code: true, favorite: false, compare: false, admin: false },
  user:  { browse: true, visualize: true, code: true, favorite: true, compare: true, admin: false },
  admin: { browse: true, visualize: true, code: true, favorite: true, compare: true, admin: true }
};

/**
 * 用户状态
 * @type {Object}
 */
export const userState = {
  role: 'guest',
  username: '',
  email: '',
  favorites: [],
  joinDate: null
};

/**
 * 检查权限
 * @param {string} action - 操作名称
 * @returns {boolean} 是否有权限
 */
export function hasPermission(action) {
  return PERMISSIONS[userState.role][action] || false;
}

/**
 * 需要登录的操作，未登录时弹出登录提示
 * @param {Function} callback - 登录后的回调函数
 */
export function requireLogin(callback) {
  if (userState.role === 'guest') {
    showLoginModal(callback);
    return;
  }
  callback();
}

// ==================== 用户数据库 ====================

/**
 * 获取用户列表
 * @returns {Array} 用户列表
 */
export function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.USERS_KEY) || '[]');
  } catch (e) {
    console.warn('Failed to parse users data:', e);
    return [];
  }
}

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @returns {{valid: boolean, message: string}} 验证结果
 */
export function validatePasswordStrength(password) {
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
  return { valid: true, message: '' };
}

/**
 * 验证管理员登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<boolean>} 是否登录成功
 */
async function verifyAdminLogin(username, password) {
  const adminPasswordHash = localStorage.getItem('admin_pass_hash');
  if (username !== 'admin' || !adminPasswordHash) return false;

  const adminSalt = localStorage.getItem('admin_salt') || '';
  const inputHash = await hashPassword(password, adminSalt);
  if (inputHash !== adminPasswordHash) return false;

  userState.role = 'admin';
  userState.username = 'admin';
  userState.email = '';
  userState.favorites = [];
  userState.joinDate = null;
  state.isAdmin = true;
  sessionStorage.setItem(CONFIG.AUTH_KEY, '1');
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
  updateUIForRole();
  showToast('管理员登录成功', 'success');
  return true;
}

/**
 * 验证普通用户密码
 * @param {Object} user - 用户对象
 * @param {string} password - 输入的密码
 * @returns {Promise<boolean>} 密码是否正确
 */
async function verifyUserPassword(user, password) {
  const storedPassword = user.password || '';
  const isV2 = storedPassword.startsWith('v2:');
  const actualHash = isV2 ? storedPassword.slice(3) : storedPassword;

  const inputHash = await hashPassword(password, user.salt || '');
  let passwordValid = false;

  if (isV2) {
    passwordValid = inputHash === actualHash;
  } else {
    passwordValid = inputHash === storedPassword;
  }

  // 兼容旧版Base64存储（迁移期间）
  if (!passwordValid && user.password === btoa(password)) {
    passwordValid = true;
  }

  return { passwordValid, isV2 };
}

/**
 * 升级用户密码哈希到 v2 格式
 * @param {Object} user - 用户对象
 * @param {string} password - 原始密码
 * @param {Array} users - 所有用户列表
 */
async function upgradePasswordHash(user, password, users) {
  const salt = generateSalt();
  user.salt = salt;
  user.password = 'v2:' + await hashPassword(password, salt);
  safeSetItem(CONFIG.USERS_KEY, JSON.stringify(users));
}

/**
 * 注册用户
 * @param {string} username - 用户名
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Promise<boolean>} 注册是否成功
 */
export async function registerUser(username, email, password) {
  const users = getUsers();
  if (users.find(u => u.username === username)) {
    showToast('用户名已存在', 'error');
    return false;
  }
  if (users.find(u => u.email === email)) {
    showToast('该邮箱已被注册', 'error');
    return false;
  }
  const salt = generateSalt();
  const hashedPassword = await hashPassword(password, salt);
  users.push({
    username,
    email,
    password: `v2:${hashedPassword}`,
    salt: salt,
    role: 'user',
    favorites: [],
    joinDate: new Date().toISOString()
  });
  localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(users));
  return true;
}

/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<boolean>} 登录是否成功
 */
export async function loginUser(username, password) {
  // 管理员登录（生产环境应通过后端验证）
  const isAdmin = await verifyAdminLogin(username, password);
  if (isAdmin) return true;

  const users = getUsers();
  const user = users.find(u => u.username === username);
  if (!user) {
    showToast('用户名或密码错误', 'error');
    return false;
  }

  // 验证密码哈希（支持版本标记）
  const { passwordValid, isV2 } = await verifyUserPassword(user, password);

  if (!passwordValid) {
    showToast('用户名或密码错误', 'error');
    return false;
  }

  // 自动升级旧版哈希到v2格式
  if (!isV2 || (user.salt && user.salt.length < 64)) {
    await upgradePasswordHash(user, password, users);
  }

  userState.role = user.role;
  userState.username = user.username;
  userState.email = user.email;
  userState.favorites = user.favorites || [];
  userState.joinDate = user.joinDate;
  state.isAdmin = false;
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
  updateUIForRole();
  showToast(`欢迎回来，${user.username}`, 'success');
  return true;
}

/**
 * 退出登录
 */
export function logoutUser() {
  userState.role = 'guest';
  userState.username = '';
  userState.email = '';
  userState.favorites = [];
  userState.joinDate = null;
  state.isAdmin = false;
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(CONFIG.AUTH_KEY);
  updateUIForRole();
  showToast('已退出登录', 'info');
}

/**
 * 初始化管理员密码（首次运行时调用）
 */
export function initAdminPassword() {
  try {
    const adminPasswordHash = localStorage.getItem('admin_pass_hash');
    if (!adminPasswordHash) {
      // 生成默认管理员密码（首次运行时）
      const defaultPassword = 'admin' + Math.random().toString(36).substring(2, 8);
      const salt = generateSalt();
      hashPassword(defaultPassword, salt).then(hash => {
        safeSetItem('admin_pass_hash', hash);
        safeSetItem('admin_salt', salt);
        // 仅在开发环境显示默认密码（生产环境应移除此日志）
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        }
      }).catch(e => {
        console.warn('[Admin] 密码哈希生成失败:', e);
      });
    }
  } catch (e) {
    console.warn('[Admin] 管理员密码初始化失败:', e);
  }
}

/**
 * 设置管理员密码（需要管理员权限）
 * @param {string} newPassword - 新密码
 * @returns {Promise<boolean>} 是否设置成功
 */
export async function setAdminPassword(newPassword) {
  if (!state.isAdmin) {
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

/**
 * 保存用户状态到 localStorage
 */
export function saveUserState() {
  const users = getUsers();
  const user = users.find(u => u.username === userState.username);
  if (user) {
    user.favorites = userState.favorites;
    safeSetItem(CONFIG.USERS_KEY, JSON.stringify(users));
  }
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
}

/**
 * 页面加载时恢复会话
 */
export function restoreSession() {
  const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
  if (session) {
    try {
      const data = JSON.parse(session);
      Object.assign(userState, data);
      if (userState.role === 'admin') {
        state.isAdmin = true;
      }
    } catch (e) {
      console.warn('会话数据解析失败');
    }
  }
  updateUIForRole();
}

/**
 * 更新用户导航区域显示
 */
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

/**
 * 更新导航按钮显示状态
 */
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

/**
 * 根据角色更新 UI
 */
export function updateUIForRole() {
  updateUserNav();
  updateNavButtons();

  // 更新收藏按钮状态
  updateFavoriteButtons();
}

// ==================== 收藏功能 ====================

/** 收藏操作锁，防止快速点击 */
const favoriteLocks = new Set();

/** 收藏状态订阅者列表 */
const favoriteSubscribers = new Set();

/**
 * 订阅收藏状态变化
 * @param {Function} callback - 回调函数 (modelName, isFav) => void
 * @returns {Function} 取消订阅函数
 */
export function subscribeToFavorites(callback) {
  favoriteSubscribers.add(callback);
  return () => favoriteSubscribers.delete(callback);
}

/**
 * 通知所有订阅者
 * @param {string} modelName - 模型名称
 * @param {boolean} isFav - 是否收藏
 */
function notifyFavoriteSubscribers(modelName, isFav) {
  favoriteSubscribers.forEach(cb => {
    try {
      cb(modelName, isFav);
    } catch (e) {
      console.warn('收藏订阅者回调失败:', e);
    }
  });
}

/**
 * 切换收藏
 * @param {string} modelName - 模型名称
 */
export function toggleFavorite(modelName) {
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

/**
 * 更新所有收藏按钮的样式
 */
export function updateFavoriteButtons() {
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const name = btn.dataset.modelName;
    const isFav = userState.favorites.includes(name);
    if (isFav) {
      btn.classList.add('active');
      // 安全：硬编码 SVG，无用户输入
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    } else {
      btn.classList.remove('active');
      // 安全：硬编码 SVG，无用户输入
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    }
    btn.setAttribute('aria-pressed', isFav);
    btn.setAttribute('aria-label', isFav ? '取消收藏' : '收藏');
  });
}

// ==================== 登录/注册模态框 ====================

/**
 * 显示登录模态框（带可选的登录后回调）
 * @param {Function} [callback] - 登录后的回调函数
 */
export function showLoginModal(callback) {
  state.pendingLoginCallback = callback || null;
  switchAuthTab('login');
  // 清空表单
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.reset();
  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.reset();
  // 隐藏错误
  const loginErr = document.getElementById('loginFormError');
  if (loginErr) loginErr.style.display = 'none';
  const regErr = document.getElementById('registerFormError');
  if (regErr) regErr.style.display = 'none';
  openModal('loginModal');
}

/**
 * 切换登录/注册标签
 * @param {string} tab - 标签名称 'login' | 'register'
 */
export function switchAuthTab(tab) {
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

/**
 * 显示表单错误信息
 * @param {HTMLElement} errorEl - 错误元素
 * @param {string} message - 错误消息
 */
function showFormError(errorEl, message) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

/**
 * 处理登录表单提交
 * @param {Event} [e] - 表单提交事件
 */
export async function handleLogin(e) {
  if (e) e.preventDefault();
  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  const errorEl = document.getElementById('loginFormError');

  if (!username || !password) {
    showFormError(errorEl, '请填写用户名和密码');
    return;
  }

  const success = await loginUser(username, password);
  if (success) {
    closeModal('loginModal');
    if (state.pendingLoginCallback) {
      const cb = state.pendingLoginCallback;
      state.pendingLoginCallback = null;
      setTimeout(cb, 100);
    }
  } else {
    showFormError(errorEl, '用户名或密码错误');
  }
}

/**
 * 验证注册表单
 * @param {string} username - 用户名
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @param {string} confirmPassword - 确认密码
 * @param {HTMLElement} errorEl - 错误元素
 * @returns {boolean} 表单是否有效
 */
function validateRegisterForm(username, email, password, confirmPassword, errorEl) {
  if (!username || username.length < 3 || username.length > 20) {
    showFormError(errorEl, '用户名需要3-20个字符');
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

/**
 * 处理注册表单提交
 * @param {Event} [e] - 表单提交事件
 */
export async function handleRegister(e) {
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

/**
 * 密码强度检测（弱/中/强）
 * @param {string} password - 密码
 */
export function checkPasswordStrength(password) {
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
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  let strength = '弱';
  let color = '#ef4444';
  let width = '33%';

  if (score >= 5) {
    strength = '强';
    color = '#22c55e';
    width = '100%';
  } else if (score >= 3) {
    strength = '中';
    color = '#f59e0b';
    width = '66%';
  }

  indicator.style.width = width;
  indicator.style.background = color;
  indicator.textContent = strength;
}

/**
 * 用户菜单下拉切换
 */
export function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  const btn = document.querySelector('.user-avatar-btn');
  if (menu) {
    const isOpen = menu.classList.toggle('active');
    if (btn) btn.setAttribute('aria-expanded', isOpen);
  }
}

/**
 * 退出管理
 */
export function logoutAdmin() {
  logoutUser();
  navigate('home');
}

/**
 * 检查认证状态（兼容旧逻辑）
 */
export function checkAuth() {
  // 由 restoreSession 统一处理
}

// 点击外部关闭用户菜单
document.addEventListener('click', function (e) {
  const userNav = document.getElementById('userNav');
  const menu = document.getElementById('userMenu');
  const btn = document.querySelector('.user-avatar-btn');
  if (userNav && menu && !userNav.contains(e.target)) {
    menu.classList.remove('active');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});
