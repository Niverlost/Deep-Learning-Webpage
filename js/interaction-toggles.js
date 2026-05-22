// ============================================================
// Interaction Toggles - 交互指南开关系统
// 管理交互指南中所有开关的状态同步、级联和持久化
// ============================================================

(function() {
  'use strict';

  var SETTINGS_KEY = 'dl_interaction_settings';

  // 分类总开关与其子开关的映射关系
  var CATEGORY_MAP = {
    mouseInteractions: ['hover', 'clickGaze', 'bodyReaction', 'scaredBounce', 'squashStretch', 'eyeTracking', 'snakeFollow'],
    lazyActions: ['lazyNodOff', 'lazyYawn', 'lazyStretch', 'lazyZoneOut', 'lazyPeek', 'lazyRubEyes'],
    socialInteractions: ['socialWhisper', 'socialEyeContact', 'socialCelebrate'],
    visualEffects: ['particleEffects', 'breathAnimation', 'randomBlinking'],
    easterEggs: ['doubleClickSpin'],
    environmentAwareness: ['nightMode', 'wavingGoodbye']
  };

  function getConfig() {
    if (window.LetterSystem && window.LetterSystem.config) {
      return window.LetterSystem.config;
    }
    return null;
  }

  function readLocalStorage() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocalStorage(obj) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
    } catch (e) {
    }
  }

  function getToggleEl(settingName) {
    return document.querySelector('.ios-toggle-input[data-setting="' + settingName + '"]');
  }

  // 同时更新 UI 和 config，不触发 change 事件
  function setToggleState(settingName, checked) {
    var el = getToggleEl(settingName);
    if (el) {
      el.checked = checked;
      el.setAttribute('aria-checked', checked ? 'true' : 'false');
    }
    var config = getConfig();
    if (config && config.hasOwnProperty(settingName)) {
      config[settingName] = checked;
    }
  }

  function updateUIFromConfig() {
    var config = getConfig();
    if (!config) return;
    for (var key in config) {
      if (config.hasOwnProperty(key)) {
        var el = getToggleEl(key);
        if (el) {
          el.checked = config[key];
          el.setAttribute('aria-checked', config[key] ? 'true' : 'false');
        }
      }
    }
  }

  function saveCurrentState() {
    var config = getConfig();
    if (!config) return;
    var toSave = {};
    for (var key in config) {
      if (config.hasOwnProperty(key)) {
        toSave[key] = config[key];
      }
    }
    writeLocalStorage(toSave);
  }

  function turnOffAllSubs(categoryKey) {
    var subKeys = CATEGORY_MAP[categoryKey];
    if (!subKeys) return;
    subKeys.forEach(function(key) {
      setToggleState(key, false);
    });
  }

  function turnOnAllSubs(categoryKey) {
    var subKeys = CATEGORY_MAP[categoryKey];
    if (!subKeys) return;
    subKeys.forEach(function(key) {
      setToggleState(key, true);
    });
  }

  function areAllCategoryMastersOff() {
    for (var cat in CATEGORY_MAP) {
      if (CATEGORY_MAP.hasOwnProperty(cat)) {
        var el = getToggleEl(cat);
        if (el && el.checked) return false;
      }
    }
    return true;
  }

  // ==================== 核心逻辑 ====================

  // 分类总开关变化处理
  function handleCategoryMasterToggle(categoryKey, masterChecked) {
    var subKeys = CATEGORY_MAP[categoryKey];
    if (!subKeys) return;

    if (masterChecked) {
      turnOnAllSubs(categoryKey);
      var allEl = getToggleEl('allInteractions');
      if (allEl && !allEl.checked) {
        setToggleState('allInteractions', true);
      }
    } else {
      turnOffAllSubs(categoryKey);
      if (areAllCategoryMastersOff()) {
        setToggleState('allInteractions', false);
      }
    }
    saveCurrentState();
  }

  // 子开关变化处理
  function handleSubToggle(categoryKey, subKey, subChecked) {
    var config = getConfig();
    if (subChecked) {
      var masterEl = getToggleEl(categoryKey);
      if (masterEl && !masterEl.checked) {
        setToggleState(categoryKey, true);
      }
      var allEl = getToggleEl('allInteractions');
      if (allEl && !allEl.checked) {
        setToggleState('allInteractions', true);
      }
    } else {
      var allOff = true;
      var subs = CATEGORY_MAP[categoryKey];
      for (var i = 0; i < subs.length; i++) {
        if (subs[i] !== subKey && config && config[subs[i]]) {
          allOff = false;
          break;
        }
      }
      if (allOff) {
        setToggleState(categoryKey, false);
        if (areAllCategoryMastersOff()) {
          setToggleState('allInteractions', false);
        }
      }
    }
    saveCurrentState();
  }

  // 全部交互总开关变化处理
  function handleGlobalMasterToggle(checked) {
    if (checked) {
      for (var cat in CATEGORY_MAP) {
        if (CATEGORY_MAP.hasOwnProperty(cat)) {
          setToggleState(cat, true);
          turnOnAllSubs(cat);
        }
      }
    } else {
      for (var cat2 in CATEGORY_MAP) {
        if (CATEGORY_MAP.hasOwnProperty(cat2)) {
          setToggleState(cat2, false);
          turnOffAllSubs(cat2);
        }
      }
    }
    saveCurrentState();
  }

  function handleToggleChange(e) {
    var input = e.target;
    var setting = input.getAttribute('data-setting');
    if (!setting) return;

    var checked = input.checked;

    var config = getConfig();
    if (config && config.hasOwnProperty(setting)) {
      config[setting] = checked;
    }

    if (setting === 'allInteractions') {
      handleGlobalMasterToggle(checked);
    } else if (CATEGORY_MAP.hasOwnProperty(setting)) {
      handleCategoryMasterToggle(setting, checked);
    } else {
      for (var cat in CATEGORY_MAP) {
        if (CATEGORY_MAP.hasOwnProperty(cat)) {
          if (CATEGORY_MAP[cat].indexOf(setting) !== -1) {
            handleSubToggle(cat, setting, checked);
            break;
          }
        }
      }
    }

    saveCurrentState();

    if (checked) {
      try {
        if (window.LetterSystem && typeof window.LetterSystem.restartAnimation === 'function') {
          window.LetterSystem.restartAnimation();
        }
      } catch (ignore) {}
    }

    e.stopPropagation();
  }

  // 加载时修复不一致
  function repairConsistency() {
    var config = getConfig();
    if (!config) return;

    // 如果 allInteractions 未定义（旧数据缺少该键），根据分类总开关状态推断
    if (config.allInteractions === undefined) {
      var anyCategoryOn = false;
      for (var cat in CATEGORY_MAP) {
        if (CATEGORY_MAP.hasOwnProperty(cat) && config[cat]) {
          anyCategoryOn = true;
          break;
        }
      }
      config.allInteractions = anyCategoryOn;
    }

    // 如果全局总开关是开的，确保所有分类和子开关都开
    if (config.allInteractions) {
      for (var cat2 in CATEGORY_MAP) {
        if (CATEGORY_MAP.hasOwnProperty(cat2)) {
          config[cat2] = true;
          CATEGORY_MAP[cat2].forEach(function(key) {
            if (config.hasOwnProperty(key)) config[key] = true;
          });
        }
      }
    }

    updateUIFromConfig();
  }

  function loadInteractionSettings() {
    var saved = readLocalStorage();
    if (!saved) return;

    var config = getConfig();
    if (!config) return;

    for (var key in saved) {
      if (saved.hasOwnProperty(key) && config.hasOwnProperty(key)) {
        config[key] = saved[key];
      }
    }

    repairConsistency();
  }

  function initInteractionToggles() {
    loadInteractionSettings();

    var toggles = document.querySelectorAll('.ios-toggle-input');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('change', handleToggleChange, false);
    }
  }

  window.loadInteractionSettings = loadInteractionSettings;
  window.initInteractionToggles = initInteractionToggles;

})();