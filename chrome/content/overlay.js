Components.utils.import('resource://gre/modules/AddonManager.jsm');
Components.utils.import('resource://decdn/tabDB.jsm');
//TODO: host toggle/combo seems to get set wrong on browser reload

var decdn_Overlay = {
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.decdn.'),
 _Defs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getDefaultBranch('extensions.decdn.'),
 _locale: Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://decdn/locale/decdn.properties'),
 _localeP: Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://decdn/locale/prefs.properties'),
 cleanup: false,
 _downloadState: false,
 init: function()
 {
  let nob = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
  nob.addObserver(decdn_Overlay, 'quit-application-granted', null);
  AddonManager.addAddonListener(
   {
    onUninstalling: function(addon)
    {
     if(addon.id === '{38DC6B77-0FD5-5F30-AC49-E9D1A422779B}')
      decdn_Overlay.cleanup = true;
    },
    onOperationCancelled: function(addon)
    {
     if(addon.id === '{38DC6B77-0FD5-5F30-AC49-E9D1A422779B}')
      decdn_Overlay.cleanup = false;
    }
   }
  );
  window.getBrowser().addProgressListener(decdn_Overlay.LocationListener);
  decdn_Overlay._Prefs.addObserver('bypassDomains', decdn_Overlay.onDomainPref, false);
  decdn_Overlay._Prefs.addObserver('blockCDNs', decdn_Overlay.onCDNPPref, false);
  decdn_Archive.load();
 },
 observe: function(subject, topic)
 {
  if (topic !== 'quit-application-granted')
   return;
  if (!decdn_Overlay.cleanup)
   return;
  decdn_Archive.reset();
  let fRem = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fRem.initWithPath(decdn_Archive.profPath);
  for (let d = 0; d < decdn_Archive.dataPath.length; d++)
  {
   fRem.appendRelativePath(decdn_Archive.dataPath[d]);
  }
  if (fRem.exists())
   fRem.remove(true);
 },
 LocationListener:
 {
  onLocationChange: function()
  {
   const tabID = decdn_Overlay._getSelTabID();
   if (tabID === false)
    return;
   decdn_Overlay._tabUpdate(tabID);
   decdn_Overlay._gc();
  }
 },

 tabReset: function(tabID)
 {
  delete decdn_TabData[tabID];
  decdn_Overlay._tabUpdate(tabID);
 },
 tabSetBypass: function(tabID)
 {
  decdn_TabData[tabID] = {
   action: decdn_CONSTS.ACTION.TAKEN.BYPASS,
   reason: decdn_CONSTS.ACTION.OPTION.BYPASS,
   reaction: false,
   resources: []
  };
  decdn_Overlay._tabUpdate(tabID);
 },
 tabAddIntercepted: function(tabID, res)
 {
  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   decdn_TabData[tabID] = {
    action: decdn_CONSTS.ACTION.TAKEN.INTERCEPT,
    reason: decdn_CONSTS.ACTION.OPTION.INTERCEPT,
    reaction: false,
    resources: []
   };
   if (decdn_Overlay._hasAdvanced())
    decdn_TabData[tabID].reason = decdn_Overlay._getTabBypass(tabID);
  }
  res.action = decdn_CONSTS.ACTION.TAKEN.INTERCEPT;
  res.reason = decdn_CONSTS.ACTION.OPTION.INTERCEPT;
  res.reaction = false;
  res.domain = decdn_Overlay._getDomain(res.source);
  let bFound = false;
  for (let i = 0; i < decdn_TabData[tabID].resources.length; i++)
  {
   if (decdn_TabData[tabID].resources[i].action !== res.action)
    continue;
   if (decdn_TabData[tabID].resources[i].path !== res.path)
    continue;
   if (decdn_TabData[tabID].resources[i].versionRequested !== res.versionRequested)
    continue;
   bFound = true;
   break;
  }
  if (!bFound)
   decdn_TabData[tabID].resources.push(res);
  decdn_Overlay._tabUpdate(tabID);
 },
 tabAddBlocked: function(tabID, dURI)
 {
  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   decdn_TabData[tabID] = {
    action: decdn_CONSTS.ACTION.TAKEN.INTERCEPT,
    reason: decdn_CONSTS.ACTION.OPTION.INTERCEPT,
    reaction: false,
    resources: []
   };
   if (decdn_Overlay._hasAdvanced())
    decdn_TabData[tabID].reason = decdn_Overlay._getTabBypass(tabID);
  }
  const res = {
   action: decdn_CONSTS.ACTION.TAKEN.BLOCK,
   reason: decdn_CONSTS.ACTION.OPTION.BLOCKMISSING,
   reaction: false,
   path: dURI.path,
   domain: decdn_Overlay._getDomain(dURI.asciiHost),
   source: dURI.asciiHost
  };
  let bFound = false;
  for (let i = 0; i < decdn_TabData[tabID].resources.length; i++)
  {
   if (decdn_TabData[tabID].resources[i].action !== res.action)
    continue;
   if (decdn_TabData[tabID].resources[i].path !== res.path)
    continue;
   bFound = true;
   break;
  }
  if (!bFound)
   decdn_TabData[tabID].resources.push(res);
  decdn_Overlay._tabUpdate(tabID);
 },
 tabAddBypassed: function(tabID, dURI)
 {
  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   decdn_TabData[tabID] = {
    action: decdn_CONSTS.ACTION.TAKEN.INTERCEPT,
    reason: decdn_CONSTS.ACTION.OPTION.INTERCEPT,
    reaction: false,
    resources: []
   };
   if (decdn_Overlay._hasAdvanced())
    decdn_TabData[tabID].reason = decdn_Overlay._getTabBypass(tabID);
  }
  const res = {
   action: decdn_CONSTS.ACTION.TAKEN.BYPASS,
   reason: decdn_CONSTS.ACTION.OPTION.BYPASSMISSING,
   reaction: false,
   path: dURI.path,
   domain: decdn_Overlay._getDomain(dURI.asciiHost),
   source: dURI.asciiHost
  };
  let bFound = false;
  for (let i = 0; i < decdn_TabData[tabID].resources.length; i++)
  {
   if (decdn_TabData[tabID].resources[i].action !== res.action)
    continue;
   if (decdn_TabData[tabID].resources[i].path !== res.path)
    continue;
   bFound = true;
   break;
  }
  if (!bFound)
   decdn_TabData[tabID].resources.push(res);
  decdn_Overlay._tabUpdate(tabID);
 },

 downloadState: function(status = false)
 {
  decdn_Overlay._downloadState = status;
  if (!!status)
  {
   decdn_Overlay._dlRender();
   return;
  }
  document.getElementById('decdn-panel').hidePopup();
  const tabID = decdn_Overlay._getSelTabID();
  if (tabID === false)
   return;
  decdn_Overlay._tabUpdate(tabID);
 },

 onButtonClick: function(ev)
 {
  if (!decdn_Overlay._downloadState)
  {
   const selTabID = decdn_Overlay._getSelTabID();
   if (selTabID === false)
    return;
   const h = decdn_Overlay._getHostOfTab(selTabID);
   if (!h)
    return;
   decdn_Overlay._pnlRender(selTabID);
  }
  if (!!ev)
  {
   const pnl = document.getElementById('decdn-panel');
   if (!!pnl)
   {
    try
    {
     const bgColor = window.getComputedStyle(pnl).getPropertyValue('background-color');
     const bgBright = decdn_Overlay._getBrightness(bgColor);
     if (bgBright < 130)
      pnl.classList.add('decdn-dark');
     else
      pnl.classList.remove('decdn-dark');
    }
    catch(ex) {}
    pnl.openPopup(ev.target, 'after_end', 0, 0, false, false, ev);
   }
  }
 },
 onHostToggle: function()
 {
  const chkHost = document.getElementById('decdn-host-toggle');
  const tabID = chkHost.getAttribute('data-tab');
  const h = decdn_Overlay._getHostOfTab(tabID);
  if (!h)
   return;
  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   decdn_TabData[tabID] = {
    action: decdn_CONSTS.ACTION.TAKEN.INTERCEPT,
    reason: decdn_CONSTS.ACTION.OPTION.INTERCEPT,
    reaction: false,
    resources: []
   };
   if (decdn_Overlay._hasAdvanced())
    decdn_TabData[tabID].reason = decdn_Overlay._getSourceBypass(h);
  }
  let val = decdn_CONSTS.ACTION.OPTION.INTERCEPT;
  if (chkHost.checked)
   val = decdn_CONSTS.ACTION.OPTION.BYPASS;
  decdn_Overlay._setSourceBypass(h, val);
  if (decdn_TabData[tabID].reason === val)
   decdn_TabData[tabID].reaction = false;
  else
   decdn_TabData[tabID].reaction = val;
  decdn_Overlay._syncHosts(tabID, val);
  decdn_Overlay._tabUpdate(tabID);
 },
 onHostCombo: function()
 {
  const cmbHost = document.getElementById('decdn-host-combo');
  const tabID = cmbHost.getAttribute('data-tab');
  const h = decdn_Overlay._getHostOfTab(tabID);
  if (!h)
   return;
  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   decdn_TabData[tabID] = {
    action: decdn_CONSTS.ACTION.TAKEN.INTERCEPT,
    reason: decdn_CONSTS.ACTION.OPTION.INTERCEPT,
    reaction: false,
    resources: []
   };
   if (decdn_Overlay._hasAdvanced())
    decdn_TabData[tabID].reason = decdn_Overlay._getSourceBypass(h);
  }
  decdn_Overlay._setSourceBypass(h, cmbHost.value);
  if (decdn_TabData[tabID].reason === cmbHost.value)
   decdn_TabData[tabID].reaction = false;
  else
   decdn_TabData[tabID].reaction = cmbHost.value;
  decdn_Overlay._syncHosts(tabID, cmbHost.value);
  decdn_Overlay._tabUpdate(tabID);
 },

 onDomainPref: function(aSubject, aTopic, aData)
 {
  let sList = decdn_Interceptor._Defs.getCharPref('bypassDomains');
  if (decdn_Interceptor._Prefs.prefHasUserValue('bypassDomains'))
   sList = decdn_Interceptor._Prefs.getCharPref('bypassDomains');
  let dObj = {};
  try
  {
   dObj = JSON.parse(sList);
  }
  catch(ex)
  {
   dObj = {};
  }
  for (const tabID in decdn_TabData)
  {
   const h = decdn_Overlay._getHostOfTab(tabID);
   if (!h)
    continue;
   let newVal = decdn_CONSTS.ACTION.OPTION.INTERCEPT;
   if (dObj.hasOwnProperty(h))
    newVal = dObj[h];
   if (decdn_TabData[tabID].reason === newVal)
    continue;
   decdn_TabData[tabID].reaction = newVal;
  }
  decdn_Overlay.iconUpdate();
 },
 onCDNPPref: function(aSubject, aTopic, aData)
 {
  let cList = decdn_Interceptor._Defs.getCharPref('blockCDNs');
  if (decdn_Interceptor._Prefs.prefHasUserValue('blockCDNs'))
   cList = decdn_Interceptor._Prefs.getCharPref('blockCDNs');
  let cObj = {};
  try
  {
   cObj = JSON.parse(cList);
  }
  catch(ex)
  {
   cObj = {};
  }
  for (const tabID in decdn_TabData)
  {
   if (decdn_TabData[tabID].reason !== decdn_CONSTS.ACTION.OPTION.INTERCEPT)
    continue;
   for (let i = 0; i < decdn_TabData[tabID].resources.length; i++)
   {
    if (decdn_TabData[tabID].resources[i].reason === decdn_CONSTS.ACTION.OPTION.INTERCEPT)
     continue;
    if (!cObj.hasOwnProperty(decdn_TabData[tabID].resources[i].source))
    {
     if (decdn_TabData[tabID].resources[i].reason === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      decdn_TabData[tabID].resources[i].reaction = false;
     else
      decdn_TabData[tabID].resources[i].reaction = decdn_CONSTS.ACTION.OPTION.BYPASSMISSING;
    }
    else
    {
     if (decdn_TabData[tabID].resources[i].reason === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
      decdn_TabData[tabID].resources[i].reaction = false;
     else
      decdn_TabData[tabID].resources[i].reaction = decdn_CONSTS.ACTION.OPTION.BLOCKMISSING;
    }
   }
  }
  decdn_Overlay.iconUpdate();
 },

 _tabUpdate: function(tabID)
 {
  if (!!decdn_Overlay._downloadState)
  {
   if (!decdn_TabData.hasOwnProperty(tabID))
   {
    decdn_TabData[tabID] = {
     action: decdn_CONSTS.ACTION.TAKEN.PENDING,
     reason: decdn_CONSTS.ACTION.OPTION.PENDING,
     reaction: false,
     resources: []
    };
   }
   decdn_Overlay._dlRender();
   return;
  }

  const mdtr = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  const brEnum = mdtr.getEnumerator('navigator:browser');
  const existList = [];
  while (brEnum.hasMoreElements())
  {
   const inst = brEnum.getNext();
   if (!inst.decdn_Overlay)
    continue;
   inst.decdn_Overlay.iconUpdate();
  }
  if (!decdn_Overlay._isSelTabID(tabID))
   return;
  //decdn_Overlay.iconUpdate();
  if (!decdn_Archive.scripts.hasOwnProperty('mappings'))
  {
   if (!decdn_TabData.hasOwnProperty(tabID))
   {
    decdn_TabData[tabID] = {
     action: decdn_CONSTS.ACTION.TAKEN.PENDING,
     reason: decdn_CONSTS.ACTION.OPTION.PENDING,
     reaction: false,
     resources: []
    };
   }
   decdn_Overlay._showRefreshNotice(tabID, 'decdn-tooltip-refresh');
   decdn_Overlay._ttMsg(decdn_CONSTS.ICON.TITLE.ERROR, decdn_Overlay._locale.GetStringFromName('notice.pending'));
   return;
  }

  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   decdn_TabData[tabID] = {
    action: decdn_CONSTS.ACTION.TAKEN.INTERCEPT,
    reason: decdn_CONSTS.ACTION.OPTION.INTERCEPT,
    reaction: false,
    resources: []
   };
   if (decdn_Overlay._hasAdvanced())
    decdn_TabData[tabID].reason = decdn_Overlay._getTabBypass(tabID);
  }

  decdn_Overlay._ttRender(tabID);
  if (document.getElementById('decdn-panel').state === 'open')
   decdn_Overlay._pnlRender(tabID);
 },

 iconUpdate: function()
 {
  const status = document.getElementById('decdn-button');
  if (!status)
   return;
  const tabID = decdn_Overlay._getSelTabID();
  if (!tabID)
   return;
  const h = decdn_Overlay._getHostOfTab(tabID);
  if (!h)
  {
   document.getElementById('decdn-panel').hidePopup();
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS, decdn_CONSTS.CLASS.DOWNLOAD);
   status.classList.add(decdn_CONSTS.CLASS.HIDDEN);
   return;
  }
  status.classList.remove(decdn_CONSTS.CLASS.HIDDEN, decdn_CONSTS.CLASS.DOWNLOAD);
  if (!decdn_Archive.scripts.hasOwnProperty('mappings'))
  {
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS);
   return;
  }
  if (!decdn_TabData.hasOwnProperty(tabID))
  {
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS);
   return;
  }
  if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASS)
  {
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT);
   status.classList.add(decdn_CONSTS.CLASS.REFRESH_BYPASS);
  }
  else if (decdn_TabData[tabID].reaction !== false)
  {
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_BYPASS);
   status.classList.add(decdn_CONSTS.CLASS.REFRESH_INTERCEPT);
  }
  else if (decdn_TabData[tabID].action === decdn_CONSTS.ACTION.TAKEN.BYPASS)
  {
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS);
   status.classList.add(decdn_CONSTS.CLASS.BYPASS);
  }
  else if (decdn_TabData[tabID].resources.length === 0)
  {
   status.classList.remove(decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS);
  }
  else
  {
   status.classList.remove(decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS);
   status.classList.add(decdn_CONSTS.CLASS.INTERCEPT);
  }
 },

 _dlRender: function()
 {
  const status = document.getElementById('decdn-button');
  if (!!status)
  {
   status.classList.remove(decdn_CONSTS.CLASS.HIDDEN, decdn_CONSTS.CLASS.INTERCEPT, decdn_CONSTS.CLASS.BYPASS, decdn_CONSTS.CLASS.REFRESH_INTERCEPT, decdn_CONSTS.CLASS.REFRESH_BYPASS);
   status.classList.add(decdn_CONSTS.CLASS.DOWNLOAD);
  }
  document.getElementById('decdn-tooltip-icon').setAttribute('src', 'chrome://decdn/skin/title/' + decdn_CONSTS.ICON.TITLE.DOWNLOAD + '.png');
  document.getElementById('decdn-panel-icon').setAttribute('src', 'chrome://decdn/skin/title/' + decdn_CONSTS.ICON.TITLE.DOWNLOAD + '.png');

  document.getElementById('decdn-host-toggle').collapsed = true;
  document.getElementById('decdn-host-combo').collapsed = true;

  document.getElementById('decdn-tooltip-refresh').collapsed = true;
  document.getElementById('decdn-panel-refresh').collapsed = true;

  const lstTT = document.getElementById('ttCDNs');
  while (lstTT.hasChildNodes())
  {
   lstTT.removeChild(lstTT.firstChild);
  }
  const lstPnl = document.getElementById('pnlCDNs');
  while (lstPnl.hasChildNodes())
  {
   lstPnl.removeChild(lstPnl.firstChild);
  }

  const lblTT = document.createElement('description');
  const lblPnl = document.createElement('description');
  if (decdn_Overlay._downloadState === 'download' || (decdn_Overlay._downloadState.length > 10 && decdn_Overlay._downloadState.slice(0, 10) === 'download: '))
  {
   lblTT.textContent = decdn_Overlay._locale.GetStringFromName('update.download');
   lblPnl.textContent = decdn_Overlay._locale.GetStringFromName('update.download');
  }
  else if (decdn_Overlay._downloadState === 'extract')
  {
   lblTT.textContent = decdn_Overlay._locale.GetStringFromName('update.extract');
   lblPnl.textContent = decdn_Overlay._locale.GetStringFromName('update.extract');
  }
  else if (decdn_Overlay._downloadState.length > 7 && decdn_Overlay._downloadState.slice(0, 7) === 'error: ')
  {
   document.getElementById('decdn-tooltip-icon').setAttribute('src', 'chrome://decdn/skin/title/' + decdn_CONSTS.ICON.TITLE.ERROR + '.png');
   document.getElementById('decdn-panel-icon').setAttribute('src', 'chrome://decdn/skin/title/' + decdn_CONSTS.ICON.TITLE.ERROR + '.png');
   lblTT.innerHTML = decdn_Overlay._locale.GetStringFromName('update.error');
   lblPnl.innerHTML = decdn_Overlay._locale.GetStringFromName('update.error');
  }
  lstTT.appendChild(lblTT);
  lstPnl.appendChild(lblPnl);
  if (decdn_Overlay._downloadState.length > 7 && decdn_Overlay._downloadState.slice(0, 7) === 'error: ')
  {
   const lblTT2 = document.createElement('description');
   const lblPnl2 = document.createElement('description');
   const errType = decdn_Overlay._downloadState.slice(7);
   let errMsg = false;
   if (errType.length === 8 && errType.slice(0, 5) === 'code ')
    errMsg = decdn_Overlay._locale.formatStringFromName('error.code', [errType.slice(5)], 1);
   else
    errMsg = decdn_Overlay._locale.GetStringFromName('error.' + errType);
   lblTT2.innerHTML = errMsg;
   lblPnl2.innerHTML = errMsg;
   lstTT.appendChild(lblTT2);
   lstPnl.appendChild(lblPnl2);
   window.setTimeout(function(){decdn_Overlay.downloadState(false);}, 5000);
   document.getElementById('decdn-panel').openPopup(status, 'after_end', 0, 0, false, false, null);
  }
  else if (decdn_Overlay._downloadState === 'download' || (decdn_Overlay._downloadState.length > 10 && decdn_Overlay._downloadState.slice(0, 10) === 'download: '))
  {
   lstTT.appendChild(document.createElement('separator')).setAttribute('class', 'thin');
   lstPnl.appendChild(document.createElement('separator')).setAttribute('class', 'thin');
   const hbTT = document.createElement('hbox');
   const hbPnl = document.createElement('hbox');
   const pbTT = document.createElement('progressmeter');
   const pbPnl = document.createElement('progressmeter');
   const lblTT2 = document.createElement('description');
   const lblPnl2 = document.createElement('description');
   lblTT2.setAttribute('class', 'pct');
   lblPnl2.setAttribute('class', 'pct');
   pbTT.setAttribute('flex', '1');
   pbPnl.setAttribute('flex', '1');
   if (decdn_Overlay._downloadState === 'download')
   {
    pbTT.setAttribute('mode', 'undetermined');
    pbPnl.setAttribute('mode', 'undetermined');
    lblTT2.setAttribute('value', '...');
    lblPnl2.setAttribute('value', '...');
   }
   else
   {
    const progress = decdn_Overlay._downloadState.slice(10).split('/', 2);
    const pct = Math.ceil((progress[0] / progress[1]) * 100);
    pbTT.setAttribute('mode', 'determined');
    pbPnl.setAttribute('mode', 'determined');
    pbTT.setAttribute('value', pct);
    pbPnl.setAttribute('value', pct);
    lblTT2.setAttribute('value', pct + '%');
    lblPnl2.setAttribute('value', pct + '%');
   }
   hbTT.appendChild(pbTT);
   hbTT.appendChild(lblTT2);
   hbPnl.appendChild(pbPnl);
   hbPnl.appendChild(lblPnl2);
   lstTT.appendChild(hbTT);
   lstPnl.appendChild(hbPnl);
  }
 },

 _ttRender: function(tabID)
 {
  decdn_Overlay._showRefreshNotice(tabID, 'decdn-tooltip-refresh');

  if (decdn_TabData[tabID].resources.length > 0)
  {
   decdn_Overlay._ttResList(tabID);
   return;
  }

  if (decdn_TabData[tabID].action === decdn_CONSTS.ACTION.TAKEN.PENDING)
   decdn_Overlay._ttMsg(decdn_CONSTS.ICON.TITLE.DOWNLOAD, decdn_Overlay._locale.GetStringFromName('notice.refresh.update'));
  else if (decdn_TabData[tabID].action === decdn_CONSTS.ACTION.TAKEN.BYPASS)
   decdn_Overlay._ttMsg(decdn_CONSTS.ICON.TITLE.BYPASS, decdn_Overlay._locale.GetStringFromName('notice.bypass'));
  else
   decdn_Overlay._ttMsg(decdn_CONSTS.ICON.TITLE.IDLE, decdn_Overlay._locale.GetStringFromName('notice.empty'));
 },
 _ttMsg: function(ico, msg)
 {
  const icoTitle = document.getElementById('decdn-tooltip-icon');
  icoTitle.setAttribute('src', 'chrome://decdn/skin/title/' + ico + '.png');

  const lstCDNs = document.getElementById('ttCDNs');
  while (lstCDNs.hasChildNodes())
  {
   lstCDNs.removeChild(lstCDNs.firstChild);
  }

  const lblMessage = document.createElement('description');
  lblMessage.textContent = msg;
  lstCDNs.appendChild(lblMessage);
 },
 _ttResList: function(tabID)
 {
  const lstCDNs = document.getElementById('ttCDNs');
  while (lstCDNs.hasChildNodes())
  {
   lstCDNs.removeChild(lstCDNs.firstChild);
  }

  const aRes = decdn_TabData[tabID].resources;
  aRes.sort(decdn_Overlay._sortByDSAP);

  let sLastSource = null;
  const sOrd = [];
  for (let i = 0; i < aRes.length; i++)
  {
   if (aRes[i].source === sLastSource)
    continue;
   sOrd.push(aRes[i].source);
   sLastSource = aRes[i].source;
  }

  if (sOrd.length > 1)
  {
   const lblServerCount = document.createElement('label');
   lblServerCount.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.cdn.count', [sOrd.length], 1));
   lstCDNs.appendChild(lblServerCount);
  }

  let hasBlock = false;
  let hasBypass = false;
  const sObj = {};
  for (let i = 0; i < aRes.length; i++)
  {
   if (!sObj.hasOwnProperty(aRes[i].source))
    sObj[aRes[i].source] = {intercept: 0, block: 0, bypass: 0, reaction: false};
   switch (aRes[i].action)
   {
    case decdn_CONSTS.ACTION.TAKEN.INTERCEPT:
     sObj[aRes[i].source].intercept++;
     sObj[aRes[i].source].reaction = aRes[i].reaction;
     break;
    case decdn_CONSTS.ACTION.TAKEN.BLOCK:
     hasBlock = true;
     sObj[aRes[i].source].block++;
     sObj[aRes[i].source].reaction = aRes[i].reaction;
     break;
    case decdn_CONSTS.ACTION.TAKEN.BYPASS:
     hasBypass = true;
     sObj[aRes[i].source].bypass++;
     sObj[aRes[i].source].reaction = aRes[i].reaction;
     break;
   }
  }

  for (let i = 0; i < sOrd.length; i++)
  {
   const source = sOrd[i];
   if (!sObj.hasOwnProperty(source))
    continue;
   const info = sObj[source];

   const hbSource = document.createElement('hbox');
   hbSource.setAttribute('class', 'decdn-source-hbox');

   const lblSource = document.createElement('label');
   lblSource.setAttribute('class', 'decdn-source-label');
   lblSource.setAttribute('value', source);
   lblSource.setAttribute('flex', '1');
   hbSource.appendChild(lblSource);

   const spSource = document.createElement('spacer');
   spSource.setAttribute('flex', '1');
   hbSource.appendChild(spSource);

   lstCDNs.appendChild(hbSource);

   if (info.intercept > 0)
   {
    const hbRow = document.createElement('hbox');
    hbRow.setAttribute('class', 'decdn-resource-group');
    hbRow.setAttribute('align', 'center');

    const icoAction = document.createElement('image');
    let ico = decdn_CONSTS.ICON.RES.INTERCEPT;
    if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASS)
     ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    icoAction.setAttribute('src', 'chrome://decdn/skin/res/' + ico + '.png');
    hbRow.appendChild(icoAction);

    const lblResG = document.createElement('label');
    lblResG.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.res.intercept', [info.intercept], 1));
    hbRow.appendChild(lblResG);

    lstCDNs.appendChild(hbRow);
   }

   if (info.block > 0)
   {
    const hbRow = document.createElement('hbox');
    hbRow.setAttribute('class', 'decdn-resource-group');
    hbRow.setAttribute('align', 'center');

    const icoAction = document.createElement('image');
    let ico = decdn_CONSTS.ICON.RES.BLOCK;
    if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.INTERCEPT)
    {
     if (decdn_Overlay._getCDNBlock(source) === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    }
    else if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASS || decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
     ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    else if (decdn_TabData[tabID].reason === decdn_CONSTS.ACTION.OPTION.INTERCEPT && !decdn_TabData[tabID].reaction)
    {
     if (info.reaction === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    }
    icoAction.setAttribute('src', 'chrome://decdn/skin/res/' + ico + '.png');
    hbRow.appendChild(icoAction);

    const lblResG = document.createElement('label');
    lblResG.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.res.block', [info.block], 1));
    hbRow.appendChild(lblResG);

    lstCDNs.appendChild(hbRow);
   }

   if (info.bypass > 0)
   {
    const hbRow = document.createElement('hbox');
    hbRow.setAttribute('class', 'decdn-resource-group');
    hbRow.setAttribute('align', 'center');

    const icoAction = document.createElement('image');
    let ico = decdn_CONSTS.ICON.RES.BYPASS;
    if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.INTERCEPT)
    {
     if (decdn_Overlay._getCDNBlock(source) === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BLOCK;
    }
    else if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
     ico = decdn_CONSTS.ICON.RES.REFRESH_BLOCK;
    else if (decdn_TabData[tabID].reason === decdn_CONSTS.ACTION.OPTION.INTERCEPT && !decdn_TabData[tabID].reaction)
    {
     if (info.reaction === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BLOCK;
    }
    icoAction.setAttribute('src', 'chrome://decdn/skin/res/' + ico + '.png');

    hbRow.appendChild(icoAction);

    const lblRes = document.createElement('label');
    lblRes.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.res.bypass', [info.bypass], 1));
    hbRow.appendChild(lblRes);

    lstCDNs.appendChild(hbRow);
   }
  }

  const icoTitle = document.getElementById('decdn-tooltip-icon');
  let tIco = decdn_CONSTS.ICON.TITLE.IDLE;
  switch (decdn_TabData[tabID].reason)
  {
   case decdn_CONSTS.ACTION.OPTION.INTERCEPT:
    if (hasBlock && hasBypass)
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT_MIXED;
    else if (hasBlock)
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT_BLOCKMISSING;
    else if (hasBypass)
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT_BYPASSMISSING;
    else
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT;
    break;
   case decdn_CONSTS.ACTION.OPTION.BLOCKMISSING:
    tIco = decdn_CONSTS.ICON.TITLE.BLOCKMISSING;
    break;
   case decdn_CONSTS.ACTION.OPTION.BYPASSMISSING:
    tIco = decdn_CONSTS.ICON.TITLE.BYPASSMISSING;
    break;
   case decdn_CONSTS.ACTION.OPTION.BYPASS:
    tIco = decdn_CONSTS.ICON.TITLE.BYPASS;
    break;
  }
  icoTitle.setAttribute('src', 'chrome://decdn/skin/title/' + tIco + '.png');
 },

 _pnlRender: function(tabID)
 {
  decdn_Overlay._showRefreshNotice(tabID, 'decdn-panel-refresh');

  if (!decdn_Archive.scripts.hasOwnProperty('mappings'))
  {
   if (!decdn_TabData.hasOwnProperty(tabID))
   {
    decdn_TabData[tabID] = {
     action: decdn_CONSTS.ACTION.TAKEN.PENDING,
     reason: decdn_CONSTS.ACTION.OPTION.PENDING,
     reaction: false,
     resources: []
    };
   }
   decdn_Overlay._pnlToggler(tabID, false, false);
   decdn_Overlay._pnlMsg(decdn_CONSTS.ICON.TITLE.ERROR, decdn_Overlay._locale.GetStringFromName('notice.pending'));
   const lstCDNs = document.getElementById('pnlCDNs');
   const hbDownload = document.createElement('hbox');
   const lSpace = document.createElement('spacer');
   lSpace.setAttribute('flex', '1');
   hbDownload.appendChild(lSpace);
   const cmdDownload = document.createElement('button');
   cmdDownload.setAttribute('type', 'button');
   cmdDownload.textContent = decdn_Overlay._locale.GetStringFromName('button.pending');
   cmdDownload.addEventListener('command', function(){
    decdn_Overlay._Prefs.clearUserPref('repo.lastCheck');
    decdn_Overlay._Prefs.clearUserPref('repo.commit');
    document.getElementById('decdn-panel').hidePopup();
    decdn_Archive.load();
   });
   hbDownload.appendChild(cmdDownload);
   lstCDNs.appendChild(hbDownload);
   return;
  }
  if (decdn_TabData[tabID].action === decdn_CONSTS.ACTION.TAKEN.PENDING)
  {
   decdn_Overlay._pnlToggler(tabID, false, false);
   decdn_Overlay._pnlMsg(decdn_CONSTS.ICON.TITLE.DOWNLOAD, decdn_Overlay._locale.GetStringFromName('notice.refresh.update'));
   return;
  }
  if (decdn_TabData[tabID].reaction !== false)
   decdn_Overlay._pnlToggler(tabID, true, decdn_TabData[tabID].reaction);
  else
   decdn_Overlay._pnlToggler(tabID, true, decdn_TabData[tabID].reason);

  if (decdn_TabData[tabID].resources.length > 0)
   decdn_Overlay._pnlResList(tabID);
  else if (decdn_TabData[tabID].action === decdn_CONSTS.ACTION.TAKEN.BYPASS)
   decdn_Overlay._pnlMsg(decdn_CONSTS.ICON.TITLE.BYPASS, decdn_Overlay._locale.GetStringFromName('notice.bypass'));
  else
   decdn_Overlay._pnlMsg(decdn_CONSTS.ICON.TITLE.IDLE, decdn_Overlay._locale.GetStringFromName('notice.empty'));
 },
 _pnlToggler: function(tabID, show, value)
 {
  const chkHost = document.getElementById('decdn-host-toggle');
  chkHost.setAttribute('data-tab', tabID);
  const cmbHost = document.getElementById('decdn-host-combo');
  cmbHost.setAttribute('data-tab', tabID);
  if (decdn_Overlay._hasAdvanced())
  {
   chkHost.collapsed = true;
   if (show)
   {
    cmbHost.collapsed = false;
    cmbHost.removeAllItems();
    const a0 = cmbHost.appendItem(decdn_Overlay._localeP.GetStringFromName('access.intercept'), decdn_CONSTS.ACTION.OPTION.INTERCEPT);
    a0.setAttribute('tooltiptext', decdn_Overlay._localeP.GetStringFromName('access.intercept.tooltip'));
    const a1 = cmbHost.appendItem(decdn_Overlay._localeP.GetStringFromName('access.blockmissing'), decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
    a1.setAttribute('tooltiptext', decdn_Overlay._localeP.GetStringFromName('access.blockmissing.tooltip'));
    const a2 = cmbHost.appendItem(decdn_Overlay._localeP.GetStringFromName('access.bypassmissing'), decdn_CONSTS.ACTION.OPTION.BYPASSMISSING);
    a2.setAttribute('tooltiptext', decdn_Overlay._localeP.GetStringFromName('access.bypassmissing.tooltip'));
    const a3 = cmbHost.appendItem(decdn_Overlay._localeP.GetStringFromName('access.bypass'), decdn_CONSTS.ACTION.OPTION.BYPASS);
    a3.setAttribute('tooltiptext', decdn_Overlay._localeP.GetStringFromName('access.bypass.tooltip'));
    cmbHost.value = value;
   }
   else
    cmbHost.collapsed = true;
  }
  else
  {
   cmbHost.collapsed = true;
   if (show)
   {
    chkHost.collapsed = false;
    chkHost.checked = value === decdn_CONSTS.ACTION.OPTION.BYPASS;
   }
   else
    chkHost.collapsed = true;
  }
 },
 _pnlMsg: function(ico, msg)
 {
  const icoTitle = document.getElementById('decdn-panel-icon');
  icoTitle.setAttribute('src', 'chrome://decdn/skin/title/' + ico + '.png');

  const lstCDNs = document.getElementById('pnlCDNs');
  while (lstCDNs.hasChildNodes())
  {
   lstCDNs.removeChild(lstCDNs.firstChild);
  }

  const lblMessage = document.createElement('description');
  lblMessage.textContent = msg;
  lstCDNs.appendChild(lblMessage);
 },
 _pnlResList: function(tabID)
 {
  const lstCDNs = document.getElementById('pnlCDNs');
  while (lstCDNs.hasChildNodes())
  {
   lstCDNs.removeChild(lstCDNs.firstChild);
  }

  const aRes = decdn_TabData[tabID].resources;
  aRes.sort(decdn_Overlay._sortByDSAP);

  let sLastSource = null;
  const sOrd = [];
  for (let i = 0; i < aRes.length; i++)
  {
   if (aRes[i].source === sLastSource)
    continue;
   sOrd.push(aRes[i].source);
   sLastSource = aRes[i].source;
  }

  if (sOrd.length > 1)
  {
   const lblServerCount = document.createElement('label');
   lblServerCount.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.cdn.count', [sOrd.length], 1));
   lstCDNs.appendChild(lblServerCount);
  }

  let hasBlock = false;
  let hasBypass = false;
  const sObj = {};
  for (let i = 0; i < aRes.length; i++)
  {
   if (!sObj.hasOwnProperty(aRes[i].source))
    sObj[aRes[i].source] = {intercept: [], block: [], bypass: [], reaction: false};
   switch (aRes[i].action)
   {
    case decdn_CONSTS.ACTION.TAKEN.INTERCEPT:
     sObj[aRes[i].source].intercept.push(aRes[i]);
     break;
    case decdn_CONSTS.ACTION.TAKEN.BLOCK:
     hasBlock = true;
     sObj[aRes[i].source].block.push(aRes[i]);
     sObj[aRes[i].source].reaction = aRes[i].reaction;
     break;
    case decdn_CONSTS.ACTION.TAKEN.BYPASS:
     hasBypass = true;
     sObj[aRes[i].source].bypass.push(aRes[i]);
     sObj[aRes[i].source].reaction = aRes[i].reaction;
     break;
   }
  }

  const hasAdv = decdn_Overlay._hasAdvanced();
  for (let i = 0; i < sOrd.length; i++)
  {
   const source = sOrd[i];
   if (!sObj.hasOwnProperty(source))
    continue;
   const hbSource = document.createElement('hbox');
   hbSource.setAttribute('class', 'decdn-source-hbox');

   const lblSource = document.createElement('label');
   lblSource.setAttribute('class', 'decdn-source-label');
   lblSource.setAttribute('value', source);
   lblSource.setAttribute('flex', '1');
   hbSource.appendChild(lblSource);

   const spSource = document.createElement('spacer');
   spSource.setAttribute('flex', '1');
   hbSource.appendChild(spSource);

   const info = sObj[source];

   let chkSource = false;
   if (hasAdv && (info.block.length > 0 || info.bypass.length > 0))
   {
    chkSource = document.createElement('checkbox');
    chkSource.setAttribute('class', 'decdn-toggle bypass-toggle');
    if (decdn_TabData[tabID].reason === decdn_CONSTS.ACTION.OPTION.INTERCEPT && !decdn_TabData[tabID].reaction)
    {
     chkSource.addEventListener('command', function(){
      decdn_Overlay._setCDNBlock(source, chkSource.checked);
      let sSet = decdn_CONSTS.ACTION.OPTION.BYPASSMISSING;
      if (chkSource.checked)
      {
       chkSource.classList.add('bypass-checked');
       sSet = decdn_CONSTS.ACTION.OPTION.BLOCKMISSING;
      }
      else
      {
       chkSource.classList.remove('bypass-checked');
      }
      decdn_Overlay._syncCDNs(source, sSet);
      decdn_Overlay._tabUpdate(tabID);
     });
    }
    else
    {
     chkSource.disabled = true;
     chkSource.setAttribute('disabled', 'disabled');
    }
    hbSource.appendChild(chkSource);
   }

   lstCDNs.appendChild(hbSource);

   if (info.intercept.length > 0)
   {
    const hbRow = document.createElement('hbox');
    hbRow.setAttribute('class', 'decdn-resource-group twisty');
    hbRow.setAttribute('align', 'center');
    hbRow.onclick = function(){hbRow.classList.toggle('twisty');};

    const icoAction = document.createElement('image');
    let ico = decdn_CONSTS.ICON.RES.INTERCEPT;
    if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASS)
     ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    icoAction.setAttribute('src', 'chrome://decdn/skin/res/' + ico + '.png');
    hbRow.appendChild(icoAction);

    const lblResG = document.createElement('label');
    lblResG.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.res.intercept', [info.intercept.length], 1));
    hbRow.appendChild(lblResG);

    lstCDNs.appendChild(hbRow);
    const vbResG = document.createElement('vbox');
    for (let r = 0; r < info.intercept.length; r++)
    {
     const hbRes = document.createElement('hbox');
     hbRes.setAttribute('class', 'decdn-resource');
     hbRes.setAttribute('align', 'center');

     const lblRes = document.createElement('label');
     lblRes.setAttribute('crop', 'center');
     const sScript = decdn_Overlay._extractFilenameFromPath(info.intercept[r].path);
     lblRes.setAttribute('value', sScript);
     lblRes.setAttribute('tooltiptext', info.intercept[r].path);
     lblRes.setAttribute('flex', '1');
     hbRes.appendChild(lblRes);

     if (info.intercept[r].versionDelivered !== 'latest')
     {
      const lblVer = document.createElement('label');
      lblVer.setAttribute('class', 'decdn-resource-version');
      if (info.intercept[r].versionRequested === 'latest' || info.intercept[r].versionDelivered === info.intercept[r].versionRequested)
       lblVer.setAttribute('value', 'v' + info.intercept[r].versionDelivered);
      else
       lblVer.setAttribute('value', 'v' + info.intercept[r].versionRequested + ' -> v' + info.intercept[r].versionDelivered);
      hbRes.appendChild(lblVer);
     }

     vbResG.appendChild(hbRes);
    }
    lstCDNs.appendChild(vbResG);
   }

   if (info.block.length > 0)
   {
    if (!!chkSource)
    {
     if (info.reaction === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
     {
      chkSource.checked = false;
      chkSource.classList.remove('bypass-checked');
     }
     else
     {
      chkSource.checked = true;
      chkSource.classList.add('bypass-checked');
     }
    }

    const hbRow = document.createElement('hbox');
    hbRow.setAttribute('class', 'decdn-resource-group twisty');
    hbRow.setAttribute('align', 'center');
    hbRow.onclick = function(){hbRow.classList.toggle('twisty');};

    const icoAction = document.createElement('image');
    let ico = decdn_CONSTS.ICON.RES.BLOCK;
    if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.INTERCEPT)
    {
     if (decdn_Overlay._getCDNBlock(source) === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    }
    else if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASS || decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
     ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    else if (decdn_TabData[tabID].reason === decdn_CONSTS.ACTION.OPTION.INTERCEPT && !decdn_TabData[tabID].reaction)
    {
     if (info.reaction === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BYPASS;
    }
    icoAction.setAttribute('src', 'chrome://decdn/skin/res/' + ico + '.png');
    hbRow.appendChild(icoAction);

    const lblResG = document.createElement('label');
    lblResG.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.res.block', [info.block.length], 1));
    hbRow.appendChild(lblResG);

    lstCDNs.appendChild(hbRow);
    const vbResG = document.createElement('vbox');
    for (let r = 0; r < info.block.length; r++)
    {
     const hbRes = document.createElement('hbox');
     hbRes.setAttribute('class', 'decdn-resource');
     hbRes.setAttribute('align', 'center');

     const lblRes = document.createElement('label');
     lblRes.setAttribute('crop', 'center');
     const sScript = decdn_Overlay._extractFilenameFromPath(info.block[r].path);
     lblRes.setAttribute('value', sScript);
     lblRes.setAttribute('tooltiptext', info.block[r].path);
     lblRes.setAttribute('flex', '1');
     hbRes.appendChild(lblRes);

     vbResG.appendChild(hbRes);
    }
    lstCDNs.appendChild(vbResG);
   }

   if (info.bypass.length > 0)
   {
    if (!!chkSource)
    {
     if (info.reaction === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
     {
      chkSource.checked = true;
      chkSource.classList.add('bypass-checked');
     }
     else
     {
      chkSource.checked = false;
      chkSource.classList.remove('bypass-checked');
     }
    }

    const hbRow = document.createElement('hbox');
    hbRow.setAttribute('class', 'decdn-resource-group twisty');
    hbRow.setAttribute('align', 'center');
    hbRow.onclick = function(){hbRow.classList.toggle('twisty');};

    const icoAction = document.createElement('image');
    let ico = decdn_CONSTS.ICON.RES.BYPASS;
    if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.INTERCEPT)
    {
     if (decdn_Overlay._getCDNBlock(source) === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BLOCK;
    }
    else if (decdn_TabData[tabID].reaction === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
     ico = decdn_CONSTS.ICON.RES.REFRESH_BLOCK;
    else if (decdn_TabData[tabID].reason === decdn_CONSTS.ACTION.OPTION.INTERCEPT && !decdn_TabData[tabID].reaction)
    {
     if (info.reaction === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
      ico = decdn_CONSTS.ICON.RES.REFRESH_BLOCK;
    }
    icoAction.setAttribute('src', 'chrome://decdn/skin/res/' + ico + '.png');
    hbRow.appendChild(icoAction);

    const lblResG = document.createElement('label');
    lblResG.setAttribute('value', decdn_Overlay._locale.formatStringFromName('notice.res.bypass', [info.bypass.length], 1));
    hbRow.appendChild(lblResG);

    lstCDNs.appendChild(hbRow);
    const vbResG = document.createElement('vbox');
    for (let r = 0; r < info.bypass.length; r++)
    {
     const hbRes = document.createElement('hbox');
     hbRes.setAttribute('class', 'decdn-resource');
     hbRes.setAttribute('align', 'center');

     const lblRes = document.createElement('label');
     lblRes.setAttribute('crop', 'center');
     const sScript = decdn_Overlay._extractFilenameFromPath(info.bypass[r].path);
     lblRes.setAttribute('value', sScript);
     lblRes.setAttribute('tooltiptext', info.bypass[r].path);
     lblRes.setAttribute('flex', '1');
     hbRes.appendChild(lblRes);

     vbResG.appendChild(hbRes);
    }
    lstCDNs.appendChild(vbResG);
   }
  }

  const icoTitle = document.getElementById('decdn-panel-icon');
  let tIco = decdn_CONSTS.ICON.TITLE.IDLE;
  switch (decdn_TabData[tabID].reason)
  {
   case decdn_CONSTS.ACTION.OPTION.INTERCEPT:
    if (hasBlock && hasBypass)
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT_MIXED;
    else if (hasBlock)
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT_BLOCKMISSING;
    else if (hasBypass)
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT_BYPASSMISSING;
    else
     tIco = decdn_CONSTS.ICON.TITLE.INTERCEPT;
    break;
   case decdn_CONSTS.ACTION.OPTION.BLOCKMISSING:
    tIco = decdn_CONSTS.ICON.TITLE.BLOCKMISSING;
    break;
   case decdn_CONSTS.ACTION.OPTION.BYPASSMISSING:
    tIco = decdn_CONSTS.ICON.TITLE.BYPASSMISSING;
    break;
   case decdn_CONSTS.ACTION.OPTION.BYPASS:
    tIco = decdn_CONSTS.ICON.TITLE.BYPASS;
    break;
  }
  icoTitle.setAttribute('src', 'chrome://decdn/skin/title/' + tIco + '.png');
 },

 _showRefreshNotice: function(tabID, elID)
 {
  const lblRefresh = document.getElementById(elID);
  if (!lblRefresh)
   return;
  lblRefresh.removeAttribute('style');
  if (!!decdn_Overlay._downloadState)
  {
   lblRefresh.collapsed = true;
   return;
  }
  if (!decdn_Archive.scripts.hasOwnProperty('mappings'))
  {
   lblRefresh.collapsed = true;
   return;
  }
  if (decdn_TabData[tabID].reaction !== false)
  {
   switch (decdn_TabData[tabID].reaction)
   {
    case decdn_CONSTS.ACTION.OPTION.BYPASS:
    case decdn_CONSTS.ACTION.OPTION.BLOCKMISSING:
    case decdn_CONSTS.ACTION.OPTION.BYPASSMISSING:
     lblRefresh.textContent = decdn_Overlay._locale.GetStringFromName('notice.refresh.' + decdn_TabData[tabID].reaction);
     break;
    case decdn_CONSTS.ACTION.OPTION.INTERCEPT:
     if (decdn_TabData[tabID].reason === decdn_CONSTS.ACTION.OPTION.BYPASS)
      lblRefresh.textContent = decdn_Overlay._locale.GetStringFromName('notice.refresh.' + decdn_TabData[tabID].reaction);
     else
      lblRefresh.textContent = decdn_Overlay._locale.GetStringFromName('notice.refresh.' + decdn_TabData[tabID].reaction + '.wasmissing');
     break;
    default:
     lblRefresh.textContent = 'Unknown Pending Action: ' + decdn_TabData[tabID].reaction;
   }
   lblRefresh.collapsed = false;
   lblRefresh.setAttribute('style', 'height: ' + lblRefresh.boxObject.height + 'px;');
   return;
  }

  let sRef = false;
  for (let i = 0; i < decdn_TabData[tabID].resources.length; i++)
  {
   if (decdn_TabData[tabID].resources[i].reaction === false)
    continue;
   let newRef = false;
   switch (decdn_TabData[tabID].resources[i].reaction)
   {
    case decdn_CONSTS.ACTION.OPTION.BYPASS:
    case decdn_CONSTS.ACTION.OPTION.BLOCKMISSING:
    case decdn_CONSTS.ACTION.OPTION.BYPASSMISSING:
     newRef = decdn_Overlay._locale.GetStringFromName('notice.refresh.' + decdn_TabData[tabID].resources[i].reaction);
     break;
    case decdn_CONSTS.ACTION.OPTION.INTERCEPT:
     if (decdn_TabData[tabID].resources[i].reason === decdn_CONSTS.ACTION.OPTION.BYPASS)
      newRef = decdn_Overlay._locale.GetStringFromName('notice.refresh.' + decdn_TabData[tabID].resources[i].reaction);
     else
      newRef = decdn_Overlay._locale.GetStringFromName('notice.refresh.' + decdn_TabData[tabID].resources[i].reaction + '.wasmissing');
     break;
    default:
     newRef = 'Unknown Pending Action: ' + decdn_TabData[tabID].resources[i].reaction;
   }
   if (sRef === false)
    sRef = newRef;
   else if (sRef !== newRef)
    sRef = decdn_Overlay._locale.GetStringFromName('notice.refresh.mixed');
  }
  if (sRef !== false)
  {
   lblRefresh.textContent = sRef;
   lblRefresh.collapsed = false;
   lblRefresh.setAttribute('style', 'height: ' + lblRefresh.boxObject.height + 'px;');
   return;
  }

  lblRefresh.collapsed = true;
  lblRefresh.textContent = 'OK';
 },

 _syncHosts: function(tabID, val)
 {
  const baseHost = decdn_Overlay._getHostOfTab(tabID);
  if (!baseHost)
   return;
  for (const tID in decdn_TabData)
  {
   if (tID === tabID)
    continue;
   const h = decdn_Overlay._getHostOfTab(tID);
   if (!h)
    continue;
   if (baseHost !== h)
    continue;
   if (decdn_TabData[tID].reason === val)
    decdn_TabData[tID].reaction = false;
   else
    decdn_TabData[tID].reaction = val;
  }
 },
 _syncCDNs: function(cdn, val)
 {
  for (const tID in decdn_TabData)
  {
   if (decdn_TabData[tID].reason !== decdn_CONSTS.ACTION.OPTION.INTERCEPT)
    continue;
   for (let r = 0; r < decdn_TabData[tID].resources.length; r++)
   {
    if (decdn_TabData[tID].resources[r].source !== cdn)
     continue;
    if (decdn_TabData[tID].resources[r].action === decdn_CONSTS.ACTION.TAKEN.INTERCEPT)
     continue;
    if (decdn_TabData[tID].resources[r].reason === val)
     decdn_TabData[tID].resources[r].reaction = false;
    else
     decdn_TabData[tID].resources[r].reaction = val;
   }
  }
 },

 _getSelTabID: function()
 {
  for (let i = 0; i < gBrowser.tabs.length; i++)
  {
   if (!gBrowser.tabs[i].hasAttribute('selected'))
    continue;
   if (gBrowser.tabs[i].getAttribute('selected') !== 'true')
    continue;
   const brw = gBrowser.tabs[i].linkedBrowser;
   if (!brw)
    continue;
   return '' + brw.outerWindowID;
  }
  return false;
 },
 _getHostOfTab: function(tabID)
 {
  const mdtr = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  const brEnum = mdtr.getEnumerator('navigator:browser');
  while (brEnum.hasMoreElements())
  {
   const inst = brEnum.getNext();
   const gB = inst.gBrowser;
   for (let i = 0; i < gB.tabs.length; i++)
   {
    const brw = gB.tabs[i].linkedBrowser;
    if (!brw)
     continue;
    const brwTabID = '' + brw.outerWindowID;
    if (brwTabID !== tabID)
     continue;
    if (brw.registeredOpenURI)
    {
     if (brw.registeredOpenURI.asciiHost === '')
      return false;
     return brw.registeredOpenURI.asciiHost;
    }
    if (!brw.contentWindow)
     continue;
    if (!brw.contentWindow.location)
     continue;
    return decdn_Overlay._getAsciiHost(brw.contentWindow.location);
   }
  }
  return false;
 },
 _isSelTabID: function(tabID)
 {
  for (let i = 0; i < gBrowser.tabs.length; i++)
  {
   if (!gBrowser.tabs[i].hasAttribute('selected'))
    continue;
   if (gBrowser.tabs[i].getAttribute('selected') !== 'true')
    continue;
   const brw = gBrowser.tabs[i].linkedBrowser;
   if (!brw)
    continue;
   const brwTabID = '' + brw.outerWindowID;
   if (brwTabID !== tabID)
    continue;
   return true;
  }
  return false;
 },

 _hasAdvanced: function()
 {
  if (decdn_Interceptor._Prefs.prefHasUserValue('blockCDNs'))
  {
   try
   {
    const aCDNs = JSON.parse(decdn_Interceptor._Prefs.getCharPref('blockCDNs'));
    if (Object.keys(aCDNs).length > 0)
     return true;
   }
   catch(ex) {}
  }
  if (decdn_Interceptor._Prefs.prefHasUserValue('bypassDomains'))
  {
   try
   {
    const aDomains = JSON.parse(decdn_Interceptor._Prefs.getCharPref('bypassDomains'));
    for (const k in aDomains)
    {
     if (aDomains[k] === decdn_CONSTS.ACTION.OPTION.BYPASS)
      continue;
     return true;
    }
   }
   catch(ex){}
  }
  return false;
 },
 _getTabBypass: function(tabID)
 {
  const h = decdn_Overlay._getHostOfTab(tabID);
  if (!h)
   return decdn_CONSTS.ACTION.OPTION.INTERCEPT;
  return decdn_Overlay._getSourceBypass(h);
 },
 _getSourceBypass: function(domain)
 {
  if (decdn_Interceptor._Prefs.prefHasUserValue('bypassDomains'))
  {
   try
   {
    const aDomains = JSON.parse(decdn_Interceptor._Prefs.getCharPref('bypassDomains'));
    if (aDomains.hasOwnProperty(domain))
     return aDomains[domain];
   }
   catch(ex){}
  }
  return decdn_CONSTS.ACTION.OPTION.INTERCEPT;
 },
 _setSourceBypass: function(domain, value = decdn_CONSTS.ACTION.OPTION.BYPASS)
 {
  let sList = decdn_Interceptor._Defs.getCharPref('bypassDomains');
  if (decdn_Interceptor._Prefs.prefHasUserValue('bypassDomains'))
   sList = decdn_Interceptor._Prefs.getCharPref('bypassDomains');
  let dObj = {};
  try
  {
   dObj = JSON.parse(sList);
  }
  catch(ex)
  {
   dObj = {};
  }
  if (value === false || value === decdn_CONSTS.ACTION.OPTION.INTERCEPT)
   delete dObj[domain];
  else
   dObj[domain] = value;
  decdn_Interceptor._Prefs.setCharPref('bypassDomains', JSON.stringify(dObj));
  return dObj.hasOwnProperty(domain);
 },
 _getCDNBlock: function(cdn)
 {
  if (decdn_Interceptor._Prefs.prefHasUserValue('blockCDNs'))
  {
   try
   {
    const aCDNs = JSON.parse(decdn_Interceptor._Prefs.getCharPref('blockCDNs'));
    if (aCDNs.hasOwnProperty(cdn))
     return aCDNs[cdn];
   }
   catch(ex){}
  }
  return decdn_CONSTS.ACTION.OPTION.BYPASSMISSING;
 },
 _setCDNBlock: function(cdn, value)
 {
  let cList = decdn_Interceptor._Defs.getCharPref('blockCDNs');
  if (decdn_Interceptor._Prefs.prefHasUserValue('blockCDNs'))
   cList = decdn_Interceptor._Prefs.getCharPref('blockCDNs');
  let cObj = {};
  try
  {
   cObj = JSON.parse(cList);
  }
  catch(ex)
  {
   cObj = {};
  }
  if (!value)
   delete cObj[cdn];
  else
   cObj[cdn] = decdn_CONSTS.ACTION.OPTION.BLOCKMISSING;
  decdn_Interceptor._Prefs.setCharPref('blockCDNs', JSON.stringify(cObj));
  return cObj.hasOwnProperty(cdn);
 },

 _gc: function()
 {
  const mdtr = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  const brEnum = mdtr.getEnumerator('navigator:browser');
  const existList = [];
  while (brEnum.hasMoreElements())
  {
   const inst = brEnum.getNext();
   const gB = inst.gBrowser;
   for (let i = 0; i < gB.tabs.length; i++)
   {
    const brw = gB.tabs[i].linkedBrowser;
    if (!brw)
     continue;
    if (!brw.outerWindowID)
     continue;
    existList.push('' + brw.outerWindowID);
   }
  }
  for (const tabID in decdn_TabData)
  {
   if (!existList.includes(tabID))
    delete decdn_TabData[tabID];
  }
 },
 _extractFilenameFromPath: function(sPath)
 {
  const aPath = sPath.split('/');
  let aFile = aPath[aPath.length - 1];
  if (aFile === '')
   return aPath[1];
  if (aFile === '+esm')
  {
   let sDir = aPath[aPath.length - 2];
   if (sDir.includes('@'))
    sDir = sDir.slice(0, sDir.indexOf('@'));
   return sDir;
  }
  if (decdn_Archive.scripts.ListOfFiles.hasOwnProperty(aFile))
   return decdn_Archive.scripts.ListOfFiles[aFile];
  if (aFile.includes('.min'))
   aFile = aFile.replaceAll('.min', '');
  if (aFile.includes('.umd'))
   aFile = aFile.replaceAll('.umd', '');
  if (aPath[0] === 'resources')
   return aPath[1] + '/' + aFile;
  return aFile;
 },
 _getAsciiHost: function(url)
 {
  if (!url.href)
   return false;
  const io = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  try
  {
   const u = io.newURI(url.href, null, null);
   if (u.asciiHost === '')
    return false;
   return u.asciiHost;
  }
  catch(ex)
  {
   return false;
  }
 },
 _getDomain: function(s)
 {
  if (s.slice(-3, -2) === '.')
   s = s.slice(0, -3);
  if (s.slice(-3, -2) === '.')
   s = s.slice(0, -3);
  else if (s.slice(-4, -3) === '.')
   s = s.slice(0, -4);
  if (s.indexOf('.') === -1)
   return s;
  return s.slice(s.lastIndexOf('.') + 1);
 },
 _sortByDSAP: function(a, b)
 {
  const d = a.domain.localeCompare(b.domain);
  if (d !== 0)
   return d;
  const s = a.source.localeCompare(b.source);
  if (s !== 0)
   return s;
  const t = a.action.localeCompare(b.action);
  if (t !== 0)
   return t;
  return a.path.localeCompare(b.path);
 },
 _getBrightness: function(sColor)
 {
  if (sColor.slice(0, 4) !== 'rgb(')
   return true;
  if (sColor.slice(-1) !== ')')
   return true;
  const rgb = sColor.slice(4, -1).split(', ');
  if (rgb.length !== 3)
   return true;
  for (let i = 0; i < rgb.length; i++)
  {
   rgb[i] = parseInt(rgb[i], 10);
  }
  return Math.sqrt(rgb[0] * rgb[0] * 0.241 + rgb[1] * rgb[1] * 0.691 + rgb[2] * rgb[2] * 0.068);
 }
};

window.addEventListener('load', decdn_Overlay.init, false);
