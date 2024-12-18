Components.utils.import('resource://gre/modules/osfile.jsm');
Components.utils.import('resource://gre/modules/FileUtils.jsm');

var decdn_Archive =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.decdn.repo.'),
 _Defs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getDefaultBranch('extensions.decdn.repo.'),
 profPath: null,
 dataPath: ['decdn'],
 _dbBranches: 'https://codeberg.org/api/v1/repos/nobody/LocalCDN/branches',
 _dbURL: 'https://codeberg.org/nobody/LocalCDN/archive/%BRANCH%.zip',
 _fPerm: 0644,
 _dPerm: 0755,
 _dbInfo: {filename: 'LocalCDN.zip', lastCheck: 0, commit: ''},
 _fileList: {
  'localcdn/core/mappings.js': {
   dest: 'mappings.js',
   replace: {
    '\nlet ': '\nvar ',
    '\nconst ': '\nvar ',
    'BrowserType.FIREFOX': 'true',
    'BrowserType.CHROMIUM': 'false'
   }
  },
  'localcdn/core/resources.js': {
   dest: 'resources.js',
   replace: {
    '\nlet ': '\nvar ',
    '\nconst ': '\nvar ',
    'BrowserType.FIREFOX': 'true',
    'BrowserType.CHROMIUM': 'false'
   }
  },
  'localcdn/core/shorthands.js': {
   dest: 'shorthands.js',
   replace: {
    '\nlet ': '\nvar ',
    '\nconst ': '\nvar ',
    'BrowserType.FIREFOX': 'true',
    'BrowserType.CHROMIUM': 'false'
   }
  },
  'localcdn/modules/internal/targets.js': {
   dest: 'targets.js',
   replace: {
    '\nlet ': '\nvar ',
    '\nconst ': '\nvar ',
    'BrowserType.FIREFOX': 'true',
    'BrowserType.CHROMIUM': 'false'
   }
  },
  'localcdn/LICENSE.txt': {
   dest: 'LICENSE.txt',
   replace: false
  },
  'localcdn/resources/': {
   dest: 'resources/',
   replace: false
  }
 },
 scripts: {},
 load: function(forceBranch = false)
 {
  decdn_Archive.profPath = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get('ProfD', Components.interfaces.nsIFile).persistentDescriptor;
  decdn_Archive._loadScripts();
  if (decdn_Archive._Prefs.prefHasUserValue('branches.api'))
   decdn_Archive._dbBranches = decdn_Archive._Prefs.getCharPref('branches.api');
  else
   decdn_Archive._dbBranches = decdn_Archive._Defs.getCharPref('branches.api');
  let urlBase = decdn_Archive._Defs.getCharPref('url.base');
  if (decdn_Archive._Prefs.prefHasUserValue('url.base'))
   urlBase = decdn_Archive._Prefs.getCharPref('url.base');
  if (decdn_Archive._Prefs.prefHasUserValue('url.zip'))
   decdn_Archive._dbURL = urlBase + decdn_Archive._Prefs.getCharPref('url.zip');
  else
   decdn_Archive._dbURL = urlBase + decdn_Archive._Defs.getCharPref('url.zip');
  if (decdn_Archive._Prefs.prefHasUserValue('lastCheck'))
   decdn_Archive._dbInfo.lastCheck = decdn_Archive._Prefs.getIntPref('lastCheck');
  else
   decdn_Archive._dbInfo.lastCheck = decdn_Archive._Defs.getIntPref('lastCheck');
  if (decdn_Archive._Prefs.prefHasUserValue('commit'))
   decdn_Archive._dbInfo.commit = decdn_Archive._Prefs.getCharPref('commit');
  else
   decdn_Archive._dbInfo.commit = decdn_Archive._Defs.getCharPref('commit');
  let branch = decdn_Archive._Defs.getCharPref('branch');
  if (!!forceBranch)
   branch = forceBranch;
  else
  {
   if (decdn_Archive._Prefs.prefHasUserValue('branch'))
    branch = decdn_Archive._Prefs.getCharPref('branch');
  }
  decdn_Archive._dbURL = decdn_Archive._dbURL.replaceAll('%BRANCH%', branch);
  const today = new Date();
  let updateEvery = decdn_Archive._Defs.getIntPref('update');
  if (decdn_Archive._Prefs.prefHasUserValue('update'))
  {
   updateEvery = decdn_Archive._Prefs.getIntPref('update');
   let trueUE = Math.ceil(updateEvery / 7) * 7;
   if (trueUE < 7)
    trueUE = 7;
   if (trueUE > 28)
    trueUE = 28;
   if (updateEvery != trueUE)
   {
    if (trueUE === 28)
     decdn_Archive._Prefs.clearUserPref('update');
    else
     decdn_Archive._Prefs.setIntPref('update', trueUE);
    updateEvery = trueUE;
   }
  }
  const uTime = Math.floor(today.getTime() / 1000);
  let getZ = true;
  if (decdn_Archive._dbInfo.lastCheck > 0)
  {
   try
   {
    if (((uTime - decdn_Archive._dbInfo.lastCheck) / 86400) < updateEvery)
     getZ = false;
   }
   catch(e)
   {
    decdn_Archive._Prefs.clearUserPref('update');
    decdn_Archive._Defs.clearUserPref('lastCheck');
    decdn_Archive._dbInfo.lastCheck = decdn_Archive._Defs.getIntPref('lastCheck');
   }
  }
  if (getZ)
   window.setTimeout(function(){decdn_Archive._update(branch);}, 400);
 },
 _update: async function(branch)
 {
  if(decdn_Archive._dbBranches === null)
   return;
  const p = new Promise((resolve, reject) => {
   const XMLHttpRequest = Components.Constructor('@mozilla.org/xmlextras/xmlhttprequest;1', 'nsIXMLHttpRequest');
   const xmlhttp = new XMLHttpRequest();
   xmlhttp.onreadystatechange = function()
   {
    if(xmlhttp.readyState !== 4)
     return;
    const respHead = xmlhttp.getAllResponseHeaders();
    if (respHead !== null)
    {
     const aHeaders = respHead.trim().split(/[\r\n]+/);
     for (let i = 0; i < aHeaders.length; i++)
     {
      const line = aHeaders[i];
      const parts = line.split(': ');
      const key = parts.shift();
      const val = parts.join(': ');
      switch(key.toLowerCase())
      {
       case 'date':
        decdn_Archive._dbInfo.lastCheck = ((new Date(val)).getTime() / 1000);
        break;
      }
     }
    }
    if(xmlhttp.status < 200 || xmlhttp.status > 299)
    {
     decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
     if(xmlhttp.status === 0)
      return;
     reject('HTTP Error ' + xmlhttp.status);
     return;
    }
    if(xmlhttp.response === null || xmlhttp.response.byteLength === 0)
    {
     decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
     reject('Empty Response');
     return;
    }
    const respData = xmlhttp.response;
    resolve(respData);
   };
   xmlhttp.onerror = function()
   {
    decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
    reject('Connection Error');
   };
   xmlhttp.mozBackgroundRequest = true;
   xmlhttp.open('GET', decdn_Archive._dbBranches);
   xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_ANONYMOUS | Components.interfaces.nsIRequest.LOAD_BACKGROUND | Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE | Components.interfaces.nsIRequest.INHIBIT_PERSISTENT_CACHING;
   xmlhttp.responseType = 'json';
   xmlhttp.setRequestHeader('Accept', 'application/json;q=0.9,*/*;q=0.8');
   xmlhttp.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
   xmlhttp.send();
  });
  const jData = await p.catch(function(err) {console.log('[ deCDN ] Server Error: ', (new URL(decdn_Archive._dbBranches)).hostname, err);});
  if (typeof jData === 'undefined' || jData === null)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  if (jData.length < 1)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  let newGUID = false;
  for (let i = 0; i < jData.length; i++)
  {
   if (!jData[i].hasOwnProperty('name'))
    continue;
   if (jData[i].name !== branch)
    continue;
   if (!jData[i].hasOwnProperty('commit'))
    continue;
   if (!jData[i].commit.hasOwnProperty('id'))
    continue;
   newGUID = jData[i].commit.id;
   break;
  }
  if (!newGUID)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  if (decdn_Archive._dbInfo.commit === newGUID)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  decdn_Archive._dbInfo.commit = newGUID;
  window.setTimeout(function(){decdn_Archive._download();}, 400);
 },
 _download: async function()
 {
  decdn_Overlay.downloadState('download');
  if(decdn_Archive.profPath === null)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  if(decdn_Archive._dbURL === null)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  const didIDM = decdn_Archive._toggleIDM(false);
  const p = new Promise((resolve, reject) => {
   const XMLHttpRequest = Components.Constructor('@mozilla.org/xmlextras/xmlhttprequest;1', 'nsIXMLHttpRequest');
   const xmlhttp = new XMLHttpRequest();
   xmlhttp.onreadystatechange = function()
   {
    xmlhttp.timeout = 0;
    if(xmlhttp.readyState !== 4)
     return;
    if (didIDM)
     decdn_Archive._toggleIDM(true);
    if(xmlhttp.status < 200 || xmlhttp.status > 299)
    {
     if(xmlhttp.status === 0)
      return;
     decdn_Overlay.downloadState('error: code ' + xmlhttp.status);
     reject('HTTP Error ' + xmlhttp.status);
     return;
    }
    if(xmlhttp.response === null || xmlhttp.response.byteLength === 0)
    {
     decdn_Overlay.downloadState('error: empty');
     reject('Empty Response');
     return;
    }
    const respData = xmlhttp.response;
    resolve(respData);
   };
   xmlhttp.onerror = function()
   {
    if (didIDM)
     decdn_Archive._toggleIDM(true);
    decdn_Overlay.downloadState('error: fail');
    reject('Connection Error');
   };
   xmlhttp.ontimeout = function()
   {
    if (didIDM)
     decdn_Archive._toggleIDM(true);
    decdn_Overlay.downloadState('error: timeout');
    reject('Connection Timeout');
   }
   xmlhttp.onprogress = function(ev)
   {
    if (ev.total > 0)
     decdn_Overlay.downloadState('download: ' + ev.loaded + '/' + ev.total);
   };
   xmlhttp.mozBackgroundRequest = true;
   xmlhttp.open('GET', decdn_Archive._dbURL);
   xmlhttp.timeout = 10000;
   xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_ANONYMOUS | Components.interfaces.nsIRequest.LOAD_BACKGROUND | Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE | Components.interfaces.nsIRequest.INHIBIT_PERSISTENT_CACHING;
   xmlhttp.responseType = 'arraybuffer';
   xmlhttp.setRequestHeader('Accept', 'application/octet-stream;q=0.9,*/*;q=0.8');
   xmlhttp.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
   xmlhttp.send();
  });
  const bData = await p.catch(function(err) {console.log('[ deCDN ] Server Error: ', (new URL(decdn_Archive._dbURL)).hostname, err);});
  if (typeof bData === 'undefined' || bData === null)
  {
   decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
   return;
  }
  decdn_Overlay.downloadState('extract');
  window.setTimeout(function() {decdn_Archive._write(new Uint8Array(bData));}, 400);
 },
 _write: async function(uData)
 {
  const fTo = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  try
  {
   fTo.initWithPath(decdn_Archive.profPath);
   for (let d = 0; d < decdn_Archive.dataPath.length; d++)
   {
    fTo.appendRelativePath(decdn_Archive.dataPath[d]);
    if (!fTo.exists())
     fTo.create(1, decdn_Archive._dPerm);
   }
   fTo.appendRelativePath(decdn_Archive._dbInfo.filename);
   if (fTo.exists())
    fTo.remove(false);
  }
  catch (ex)
  {
   console.log('[ deCDN ] Error Creating Save Path: ', ex);
   decdn_Overlay.downloadState('error: save');
   return;
  }
  const fOut = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
  const bOut = Components.classes['@mozilla.org/binaryoutputstream;1'].createInstance(Components.interfaces.nsIBinaryOutputStream);
  try
  {
   fOut.init(fTo, 0x02 | 0x08 | 0x20, decdn_Archive._fPerm, 0);
   bOut.setOutputStream(fOut);
   bOut.writeByteArray(uData, uData.length);
  }
  catch (ex)
  {
   console.log('[ deCDN ] Error Saving Archive: ', ex);
   decdn_Overlay.downloadState('error: save');
   return;
  }
  finally
  {
   bOut.close();
   fOut.close();
  }
  decdn_Archive._Prefs.setIntPref('lastCheck', decdn_Archive._dbInfo.lastCheck);
  decdn_Archive._Prefs.setCharPref('commit', decdn_Archive._dbInfo.commit);
  await decdn_Archive._extract(fTo);
  if (fTo.exists())
   fTo.remove(false);
  decdn_Archive._loadScripts();
  decdn_Overlay.downloadState(false);
 },
 _extract: async function(fFrom)
 {
  const zRead = Components.classes['@mozilla.org/libjar/zip-reader;1'].createInstance(Components.interfaces.nsIZipReader);
  try
  {
   zRead.open(fFrom);
  }
  catch(ex)
  {
   console.log('[ deCDN ] Error Finding Saved Archive: ', ex);
   decdn_Overlay.downloadState('error: save');
   return;
  }
  try
  {
   const entries = zRead.findEntries('*');
   while (entries.hasMore())
   {
    const eName = entries.getNext();
    const match = decdn_Archive._startsWithInArray(decdn_Archive._fileList, eName);
    if (!match)
     continue;
    const eInfo = zRead.getEntry(eName);
    if (eInfo.isDirectory)
     continue;
    const newName = eName.replace(match, decdn_Archive._fileList[match].dest);
    await decdn_Archive._save(newName, zRead.getInputStream(eName), eInfo.realSize, decdn_Archive._fileList[match].replace);
   }
  }
  catch (ex)
  {
   console.log('[ deCDN ] Error Extracting Archive: ', ex);
   decdn_Overlay.downloadState('error: Error Extracting Archive');
  }
  finally
  {
   zRead.close();
  }
 },
 _startsWithInArray: function(haystack, needle)
 {
  const keys = Object.keys(haystack);
  for (let i = 0; i < keys.length; i++)
  {
   if (needle.toLowerCase().startsWith(keys[i].toLowerCase()))
    return keys[i];
  }
  return false;
 },
 _save: async function(sFile, ioFile, fSize, replace = false)
 {
  const fTo = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fTo.initWithPath(decdn_Archive.profPath);
  for (let d = 0; d < decdn_Archive.dataPath.length; d++)
  {
   fTo.appendRelativePath(decdn_Archive.dataPath[d]);
   if (!fTo.exists())
    fTo.create(1, decdn_Archive._dPerm);
  }
  const aName = sFile.split('/');
  if (aName.length > 1)
  {
   for (let d = 0; d < aName.length - 1; d++)
   {
    fTo.appendRelativePath(aName[d]);
    if (!fTo.exists())
     fTo.create(1, decdn_Archive._dPerm);
   }
  }
  fTo.appendRelativePath(aName[aName.length - 1]);

  const fOut = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
  fOut.init(fTo, 0x02 | 0x08 | 0x20, decdn_Archive._fPerm, 0);

  if (!replace)
  {
   const eData = new ArrayBuffer(fSize);

   const bis = Components.classes['@mozilla.org/binaryinputstream;1'].createInstance(Components.interfaces.nsIBinaryInputStream);
   bis.setInputStream(ioFile);
   bis.readArrayBuffer(fSize, eData);

   const bOut = Components.classes['@mozilla.org/binaryoutputstream;1'].createInstance(Components.interfaces.nsIBinaryOutputStream);
   bOut.setOutputStream(fOut);

   const uData = new Uint8Array(eData);
   bOut.writeByteArray(uData, uData.length);
   bOut.close();

   fOut.close();
   return;
  }

  const tis = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
  tis.init(ioFile);
  let sData = tis.read(fSize);

  const sFrom = Object.keys(replace);
  for (let i = 0; i < sFrom.length; i++)
  {
   if (!sData.includes(sFrom[i]))
    continue;
   sData = sData.replaceAll(sFrom[i], replace[sFrom[i]]);
  }

  const tOut = Components.classes['@mozilla.org/intl/converter-output-stream;1'].createInstance(Components.interfaces.nsIConverterOutputStream);
  tOut.init(fOut, 'UTF-8', fSize, 0);

  tOut.writeString(sData);
  tOut.close();

  fOut.close();
 },
 _loadScripts: function()
 {
  decdn_Archive.scripts = {};
  Services.scriptloader.loadSubScript('chrome://decdn/content/extern/LocalCDN.js', decdn_Archive.scripts);
  decdn_Archive._loadScript('resources.js');
  decdn_Archive._loadScript('mappings.js');
  decdn_Archive._loadScript('shorthands.js');
  decdn_Archive._loadScript('targets.js');
 },
 _loadScript: function(sName)
 {
  const fTo = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fTo.initWithPath(decdn_Archive.profPath);
  for (let d = 0; d < decdn_Archive.dataPath.length; d++)
  {
   fTo.appendRelativePath(decdn_Archive.dataPath[d]);
   if (!fTo.exists())
    return;
  }
  const aName = sName.split('/');
  for (let d = 0; d < aName.length; d++)
  {
   fTo.appendRelativePath(aName[d]);
   if (!fTo.exists())
    return;
  }
  const sTo = Services.io.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler).getURLSpecFromActualFile(fTo);
  Services.scriptloader.loadSubScript(sTo, decdn_Archive.scripts);
 },
 _toggleIDM: function(state)
 {
  try
  {
   let reg = Components.classes['@mozilla.org/windows-registry-key;1'].createInstance(Components.interfaces.nsIWindowsRegKey);
   reg.open(reg.ROOT_KEY_CURRENT_USER, 'SOFTWARE', reg.ACCESS_ALL);

   if (!reg.hasChild('DownloadManager'))
    return false;
   reg = reg.openChild('DownloadManager', reg.ACCESS_READ | reg.ACCESS_SET_VALUE);

   if (!reg.hasChild('IDMBI'))
    return false;
   reg = reg.openChild('IDMBI', reg.ACCESS_READ | reg.ACCESS_SET_VALUE);

   if (!reg.hasChild('palemoon'))
    return false;
   reg = reg.openChild('palemoon', reg.ACCESS_READ | reg.ACCESS_SET_VALUE);

   if (!reg.hasValue('int'))
    return false;
   if (reg.getValueType('int') !== reg.TYPE_INT)
    return false;

   const curState = reg.readIntValue('int');
   if (state === false)
   {
    if (curState !== 1)
     return false;
    console.log('[ deCDN ] Disabling IDM for Pale Moon');
    reg.writeIntValue('int', 0);
    return true;
   }
   if (state === true)
   {
    if (curState !== 0)
     return false;
    console.log('[ deCDN ] Re-enabling IDM for Pale Moon');
    reg.writeIntValue('int', 1);
    return true;
   }
  }
  catch(ex)
  {
   console.log('[ deCDN ] IDM Control Error Accessing Registry: ', ex);
  }
  return false;
 },
 erase: function()
 {
  const fDel = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fDel.initWithPath(decdn_Archive.profPath);
  fDel.appendRelativePath(decdn_Archive.dataPath[0]);
  if (fDel.exists())
   fDel.remove(true);
  decdn_Archive.scripts = {};
  decdn_Archive._Prefs.clearUserPref('lastCheck');
  decdn_Archive._Prefs.clearUserPref('commit');
  decdn_Archive._dbInfo.lastCheck = 0;
  decdn_Archive._dbInfo.commit = '';
 },
 reset: function()
 {
  decdn_Archive.scripts = {};
  decdn_Archive._Prefs.clearUserPref('lastCheck');
  decdn_Archive._Prefs.clearUserPref('commit');
  decdn_Archive._dbInfo.lastCheck = 0;
  decdn_Archive._dbInfo.commit = '';
 }
};
