var decdn_Interceptor = {
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.decdn.'),
 _Defs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getDefaultBranch('extensions.decdn.'),
 BYPASSED: {
  /*  List of protocols to completely ignore.
   *
   *  NOTE: do not include the colon or protocol separator.
   */
  SCHEME: [
  'about',
  'chrome',
  'data',
  'resource'
  ],
  /*  List of content-types to completely ignore.
   *  This needs to be a minimal list of types.
   *  Particularly, those that hooking into and waiting for
   *  a completed response would be deterimental to functionality.
   *
   *  NOTE: do not use asterisks. The code looks for startsWith('/') and endsWith('/').
   */
  MIME: [
   'image/',
   'audio/',
   'video/',
   'text/event-stream'
  ]
 },
 reg: {
  tags: /<(link|script)[^>]+>/ig,
  wholeLink: /<link[^>]+>/dig,
  beginScript: /<script[^>]*>/dig,
  endScript: /<\/script(?:\s+[^>]*)?>/dig,
  attrs: /([^\s\0"'>/=]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)'|\s*=\s*([^"'`=>\s]+={0,2})(?<!\/)|)/g,
  attrMap: /\s+type\s*=\s*(?:importmap|'importmap'|"importmap")/i,
  blocks: /\s+(integrity|crossorigin)(\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^"'`=>\s]+={0,2}(?<!\/)|)/ig,
  map: /<script[^>]*?\s+type\s*=\s*(?:importmap|'importmap'|"importmap")(?:\s+[^>]*?)?>(.+?)<\/script(?:\s+[^>]*)?>/igs
 },
 cache: {},
 LoadListener: function()
 {
  const observerService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
  observerService.addObserver(decdn_Interceptor.RequestObserver, 'http-on-modify-request', false);
  observerService.addObserver(decdn_Interceptor.ResponseObserver, 'http-on-examine-response', false);
  observerService.addObserver(decdn_Interceptor.ResponseObserver, 'http-on-examine-cached-response', false);
  observerService.addObserver(decdn_Interceptor.ResponseObserver, 'http-on-examine-merged-response', false);
 },
 RequestObserver:
 {
  observe: function(aSubject)
  {
   if (!decdn_Archive.scripts.hasOwnProperty('mappings'))
    return;

   const channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
   if (channel === Components.results.NS_NOINTERFACE)
    return;
   if (channel.requestMethod !== 'GET')
    return;

   const wndInf = decdn_Interceptor._getWindowInfo(channel);
   if (!!wndInf.windowChrome && wndInf.windowChrome !== window)
    return;

   const dURIs = decdn_Interceptor._getURIs(channel);
   if (!dURIs.file)
    return;

   if (!!wndInf.tabID && !dURIs.document && !dURIs.root && (channel.loadFlags & channel.LOAD_INITIAL_DOCUMENT_URI) === channel.LOAD_INITIAL_DOCUMENT_URI)
    decdn_Overlay.tabReset(wndInf.tabID);

   if (decdn_Interceptor.BYPASSED.SCHEME.includes(dURIs.file.scheme))
    return;
   if (decdn_Interceptor._getBypass(dURIs.file.asciiHost))
   {
    if (!!wndInf.tabID && !dURIs.document && !dURIs.root)
     decdn_Overlay.tabSetBypass(wndInf.tabID);
    return;
   }

   if (!dURIs.document)
    return;
   if (decdn_Interceptor.BYPASSED.SCHEME.includes(dURIs.document.scheme))
    return;
   if (decdn_Interceptor._getBypass(dURIs.document.asciiHost))
    return;

   if (!!dURIs.root && decdn_Interceptor._getBypass(dURIs.root.asciiHost))
    return;

   if (!decdn_Archive.scripts.mappings['cdn'].hasOwnProperty(dURIs.file.asciiHost))
    return;

   const rTarget = decdn_Parser.process(dURIs.file);
   if (!rTarget)
    return;

   let stripHeaders = decdn_Interceptor._Defs.getBoolPref('stripheaders');
   if (decdn_Interceptor._Prefs.prefHasUserValue('stripheaders'))
    stripHeaders = decdn_Interceptor._Prefs.getBoolPref('stripheaders');
   if (stripHeaders)
   {
    channel.setRequestHeader('cookie', null, false);
    channel.setRequestHeader('origin', null, false);
    channel.setRequestHeader('referer', null, false);
   }

   if (rTarget === 'blockable')
   {
    const aDom = decdn_Interceptor._getAdvDomain(dURIs);
    if (aDom === null)
    {
     if (!!wndInf.tabID)
      decdn_Overlay.tabAddBlocked(wndInf.tabID, dURIs.file);
     channel.cancel(Components.results.NS_ERROR_NOT_AVAILABLE);
     return;
    }
    if (aDom === true)
    {
     if (!!wndInf.tabID)
      decdn_Overlay.tabAddBypassed(wndInf.tabID, dURIs.file);
     return;
    }

    const aCDN = decdn_Interceptor._getAdvCDN(dURIs.file.asciiHost);
    if (aCDN === null)
    {
     if (!!wndInf.tabID)
      decdn_Overlay.tabAddBlocked(wndInf.tabID, dURIs.file);
     channel.cancel(Components.results.NS_ERROR_NOT_AVAILABLE);
     return;
    }
    if (aCDN === true)
    {
     if (!!wndInf.tabID)
      decdn_Overlay.tabAddBypassed(wndInf.tabID, dURIs.file);
     return;
    }

    if (!!wndInf.tabID)
     decdn_Overlay.tabAddBypassed(wndInf.tabID, dURIs.file);
    return;
   }

   if (!rTarget.hasOwnProperty('path'))
    return;
   let downgrade = decdn_Interceptor._Defs.getBoolPref('downgrade');
   if (decdn_Interceptor._Prefs.prefHasUserValue('downgrade'))
    downgrade = decdn_Interceptor._Prefs.getBoolPref('downgrade');
   if (!downgrade)
   {
    if (!decdn_Archive.scripts.helpers.compareVersion(rTarget.versionDelivered, rTarget.versionRequested))
     return;
   }
   const sRedir = decdn_Data.getRedirectionURI(rTarget.path);
   if (!sRedir)
    return;
   if (!!wndInf.browser)
   {
    if (!wndInf.browser.decdnCacheID)
     wndInf.browser.decdnCacheID = crypto.randomUUID();
    if (!decdn_Interceptor.cache.hasOwnProperty(wndInf.browser.decdnCacheID))
    {
     decdn_Interceptor.cache[wndInf.browser.decdnCacheID] = {};
     wndInf.browser.addEventListener('unload',
      function()
      {
       delete decdn_Interceptor.cache[wndInf.browser.decdnCacheID];
       delete wndInf.browser.decdnCacheID;
      },
      {capture: true, passive: true, once: true}
     );
    }
    decdn_Interceptor.cache[wndInf.browser.decdnCacheID][dURIs.file.asciiSpec] = {target: rTarget, redir: sRedir};
   }
   if (!!wndInf.tabID)
    decdn_Overlay.tabAddIntercepted(wndInf.tabID, rTarget);
   channel.redirectTo(sRedir);
  },
  QueryInterface : function(aIID)
  {
   if (aIID.equals(Components.interfaces.nsIObserver) || aIID.equals(Components.interfaces.nsISupports))
    return this;
   throw Components.results.NS_NOINTERFACE;
  }
 },
 ResponseObserver:
 {
  observe: function(aSubject)
  {
   const channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
   if (channel === Components.results.NS_NOINTERFACE)
    return;

   try
   {
    if (!!channel.contentType)
    {
     const cMIME = channel.contentType.toLowerCase();
     if (decdn_Interceptor._bypassMIME(cMIME))
      return;
    }
   }
   catch(ex) {}

   const wndInf = decdn_Interceptor._getWindowInfo(channel);
   if (!!wndInf.windowChrome && wndInf.windowChrome !== window)
    return;
   const dURIs = decdn_Interceptor._getURIs(channel);
   if (!dURIs.file)
    return;
   if (decdn_Interceptor.BYPASSED.SCHEME.includes(dURIs.file.scheme))
    return;
   if (decdn_Interceptor._getBypass(dURIs.file.asciiHost))
    return;
   if (!!dURIs.document && decdn_Interceptor._getBypass(dURIs.document.asciiHost))
    return;
   if (!!dURIs.root && decdn_Interceptor._getBypass(dURIs.root.asciiHost))
    return;

   let newListener = new decdn_Interceptor.TraceListener();
   try
   {
    if (!!channel.contentType)
     newListener.mime = channel.contentType;
   }
   catch (ex)
   {
    newListener.mime = false;
   }
   newListener.dURIs = dURIs;

   if (!!wndInf.browser)
   {
    if (!wndInf.browser.decdnCacheID)
     wndInf.browser.decdnCacheID = crypto.randomUUID();
    newListener.browserID = wndInf.browser.decdnCacheID;
   }

   const trace = aSubject.QueryInterface(Components.interfaces.nsITraceableChannel);
   if (trace === Components.results.NS_NOINTERFACE)
    return;
   newListener.originalListener = trace.setNewListener(newListener);

   let hRet = false;
   try
   {
    hRet = channel.getResponseHeader('content-security-policy');
   }
   catch(ex)
   {
    return;
   }
   if (!hRet)
    return;
   const hSects = hRet.split(';');
   let changed = false;
   for (let i = 0; i < hSects.length; i++)
   {
    if (hSects[i].trim() === '')
     continue;
    let sSect = hSects[i].trim();
    while (sSect.includes('  '))
     sSect = sSect.replaceAll('  ', ' ');
    const hParts = sSect.split(' ');
    if (hParts[0] === 'require-sri-for')
    {
     hSects.splice(i, 1);
     i--;
     changed = true;
     continue;
    }
    if (!(hParts[0] === 'default-src' || hParts[0] === 'connect-src' || hParts[0] === 'script-src' || hParts[0] === 'style-src' || hParts[0] === 'font-src'))
     continue;
    if (hParts.includes('data:', 1))
     continue;
    if (hParts.length === 2 && hParts[1] === '\'none\'')
     hSects[i] = hParts[0] + ' data:';
    else
     hSects[i] += ' data:';
    changed = true;
   }
   if (changed)
    channel.setResponseHeader('content-security-policy', hSects.join(';'), false);
  },
  QueryInterface : function(aIID)
  {
   if (aIID.equals(Components.interfaces.nsIObserver) || aIID.equals(Components.interfaces.nsISupports))
    return this;
   throw Components.results.NS_NOINTERFACE;
  }
 },
 TraceListener: function()
 {
  // URIs of the Requested, Requester, and Context
  this.dURIs = {file: false, document: false, root: false};
  // a UUID generated by deCDN for identification
  this.browserID = false;
  // the content-type of a response (subject to change)
  this.mime = false;
  // is this a parity-cache response?
  this.cache = false;
  // is this an html-ish file that we should replace the contents of?
  this.replace = false;
  // should we completely ignore this file, regardless of other statuses?
  // this is set by decdn_Interceptor.BYPASSED.MIME if this.mime changes
  this.bypass = false;
  // stuck in an import map?
  this.importmapping = false;
  // required for basic functionality
  this.originalListener = null;
  // stored data, used if this.replace is true
  this.receivedData = [];
 }, 
 _listedContent: function(requestURI)
 {
  if (!decdn_Archive.scripts.hasOwnProperty('mappings'))
   return;
  if (!decdn_Archive.scripts.mappings['cdn'].hasOwnProperty(requestURI.asciiHost))
   return false;
  const r = decdn_Parser.process(requestURI);
  if (!r)
   return false;
  if (r === 'blockable')
   return false;
  if (r.hasOwnProperty('result'))
   return false;
  return r;
 },
 _getURIs: function(aSubject)
 {
  let dFile = false;
  let dDoc = false;
  let dRoot = false;
  const channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
  if (!channel || channel === Components.results.NS_NOINTERFACE)
   return {file: dFile, document: dDoc, root: dRoot};
  if (!!channel.URI)
   dFile = channel.URI;
  if (channel.loadInfo !== null && channel.loadInfo.loadingDocument !== null && channel.loadInfo.loadingDocument.location !== null)
  {
   dDoc = decdn_URITools.makeURI(channel.loadInfo.loadingDocument.location.href);
   const fRoot = decdn_Interceptor._getRootDoc(channel.loadInfo.loadingDocument);
   dRoot = decdn_URITools.makeURI(fRoot.location.href);
  }
  if (!!dDoc)
  {
   const tmpFile = decdn_URITools.makeURI(channel.URI.spec, dDoc);
   if (!!tmpFile)
    dFile = tmpFile;
  }
  return {file: dFile, document: dDoc, root: dRoot};
 },
 _getRootDoc: function(doc)
 {
  if (!doc.defaultView)
   return doc;
  if (!doc.defaultView.top)
   return doc;
  if (!doc.defaultView.top.document)
   return doc;
  return doc.defaultView.top.document;
 },
 _getBypass: function(host)
 {
  let sD = decdn_Interceptor._Defs.getCharPref('bypassDomains');
  if (decdn_Interceptor._Prefs.prefHasUserValue('bypassDomains'))
   sD = decdn_Interceptor._Prefs.getCharPref('bypassDomains');
  try
  {
   const dObj = JSON.parse(sD);
   if (!dObj.hasOwnProperty(host))
    return false;
   return dObj[host] === decdn_CONSTS.ACTION.OPTION.BYPASS;
  }
  catch(ex)
  {
   return false;
  }
 },
 _getAdvDomain: function(dURIs)
 {
  let sHost = false;
  if (!!dURIs.file && !dURIs.document && !dURIs.root)
   sHost = dURIs.file.asciiHost;
  else if (!!dURIs.root)
   sHost = dURIs.root.asciiHost;
  if (!sHost)
   return false;
  let domains = decdn_Interceptor._Defs.getCharPref('bypassDomains');
  if (decdn_Interceptor._Prefs.prefHasUserValue('bypassDomains'))
   domains = decdn_Interceptor._Prefs.getCharPref('bypassDomains');
  let jD = false;
  try
  {
   jD = JSON.parse(domains);
  }
  catch (ex)
  {
   jD = false;
  }
  if (!jD)
   return false;
  if (!jD.hasOwnProperty(sHost))
   return false;
  switch(jD[sHost])
  {
   case decdn_CONSTS.ACTION.OPTION.BYPASS:
   case decdn_CONSTS.ACTION.OPTION.BYPASSMISSING:
    return true;
   case decdn_CONSTS.ACTION.OPTION.BLOCKMISSING:
    return null;
  }
  return false;
 },
 _getAdvCDN: function(sHost)
 {
  let cdns = decdn_Interceptor._Defs.getCharPref('blockCDNs');
  if (decdn_Interceptor._Prefs.prefHasUserValue('blockCDNs'))
   cdns = decdn_Interceptor._Prefs.getCharPref('blockCDNs');
  const jC = JSON.parse(cdns);
  if (!jC.hasOwnProperty(sHost))
   return false;
  switch(jC[sHost])
  {
   case decdn_CONSTS.ACTION.OPTION.BYPASSMISSING:
    return true;
   case decdn_CONSTS.ACTION.OPTION.BLOCKMISSING:
    return null;
  }
  return false;
 },
 _pullFromCache: function(bID, requestURI)
 {
  if (!decdn_Interceptor.cache.hasOwnProperty(bID))
   return false;
  if (!decdn_Interceptor.cache[bID].hasOwnProperty(requestURI))
   return false;
  const cachedRedir = decdn_Interceptor.cache[bID][requestURI].redir;
  const hdrPos = cachedRedir.asciiSpec.indexOf(',');
  if (hdrPos < 5)
   return false;
  const hdr = cachedRedir.asciiSpec.slice(0, hdrPos);
  const body = decodeURIComponent(cachedRedir.asciiSpec.slice(hdrPos + 1));
  if (hdr.endsWith(';base64'))
   return window.atob(body);
  return body;
 },
 _getWindowInfo: function(aSubject)
 {
  const ret = {
   browser: false,
   tab: false,
   windowContent: false,
   windowChrome: false,
   gBrowser: false,
   tabID: false,
  };
  const channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
  if (!channel || channel === Components.results.NS_NOINTERFACE)
   return ret;
  if (!channel.loadGroup)
   return ret;
  if (!channel.loadGroup.notificationCallbacks)
   return ret;
  const ctxLoad = channel.loadGroup.notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
  if (!ctxLoad || ctxLoad === Components.results.NS_NOINTERFACE)
   return ret;
  try
  {
   if (!ctxLoad.associatedWindow)
    return ret;
  }
  catch(ex)
  {
   return ret;
  }
  ret.windowContent = ctxLoad.associatedWindow;
  let wnd = false;
  if (!!ctxLoad.associatedWindow.top)
   wnd = ctxLoad.associatedWindow.top;
  else
   wnd = ctxLoad.associatedWindow;
  if (!wnd)
   return ret;
  const wndReq = wnd.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
  if (!wndReq || wndReq === Components.results.NS_NOINTERFACE)
   return ret;
  const nav = wndReq.getInterface(Components.interfaces.nsIWebNavigation);
  if (!nav || nav === Components.results.NS_NOINTERFACE)
   return ret;
  const docTree = nav.QueryInterface(Components.interfaces.nsIDocShellTreeItem);
  if (!docTree || docTree === Components.results.NS_NOINTERFACE)
   return ret;
  const rootTree = docTree.rootTreeItem;
  const treeReq = rootTree.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
  if (!treeReq || treeReq === Components.results.NS_NOINTERFACE)
   return ret;
  const wndDom = treeReq.getInterface(Components.interfaces.nsIDOMWindow);
  if (!wndDom || wndDom === Components.results.NS_NOINTERFACE)
   return ret;
  ret.windowChrome = wndDom;
  if (!wndDom.gBrowser)
   return ret;
  ret.gBrowser = wndDom.gBrowser;
  if (!ret.gBrowser)
   return ret;
  if (!ret.gBrowser._getTabForContentWindow)
   return ret;
  ret.tab = ret.gBrowser._getTabForContentWindow(wnd);
  if (!ret.tab)
   return ret;
  if (!ret.tab.linkedBrowser)
   return ret;
  ret.browser = ret.tab.linkedBrowser;
  ret.tabID = '' + ret.tab.linkedBrowser.outerWindowID;
  return ret;
 },
 _bypassMIME(cMIME)
 {
  for (let i = 0; i < decdn_Interceptor.BYPASSED.MIME.length; i++)
  {
   const iMIME = decdn_Interceptor.BYPASSED.MIME[i].toLowerCase();
   if (iMIME.startsWith('/'))
   {
    if (cMIME.endsWith(iMIME))
     return true;
   }
   else if (iMIME.endsWith('/'))
   {
    if (cMIME.startsWith(iMIME))
     return true;
   }
   else
   {
    if (cMIME === iMIME)
     return true;
   }
  }
  return false;
 },
 _replaceContent: function(data, dURIs)
 {
  data = data.replace(decdn_Interceptor.reg.tags,
   function(match)
   {
    const attrs = match.matchAll(decdn_Interceptor.reg.attrs);
    let uri = false;
    let hasBad = false;
    for (const attr of attrs)
    {
     if (attr[1] === 'src' || attr[1] === 'href')
     {
      if (typeof attr[2] !== 'undefined')
       uri = attr[2];
      else if (typeof attr[3] !== 'undefined')
       uri = attr[3];
      else if (typeof attr[4] !== 'undefined')
       uri = attr[4];
     }
     if (attr[1] === 'crossorigin')
      hasBad = true;
     if (attr[1] === 'integrity')
      hasBad = true;
    }
    if (!hasBad)
     return match;
    if (!uri)
     return match;
    const sURI = decdn_URITools.makeURI(uri, dURIs.file);
    const r = decdn_Interceptor._listedContent(sURI);
    if (!r)
     return match;
    match = match.replace(decdn_Interceptor.reg.blocks, '');
    return match;
   }
  );

  data = data.replace(decdn_Interceptor.reg.map,
   function(match, p)
   {
    try
    {
     const jData = JSON.parse(p);
     if (!jData)
      return match;
     if (!jData.hasOwnProperty('integrity'))
      return match;
     delete jData['integrity'];
     return match.replace(p, JSON.stringify(jData));
    }
    catch(ex) {}
    return match;
   }
  );

  return data;
 }
};

decdn_Interceptor.TraceListener.prototype = {
 onStartRequest: function(request, context)
 {
  let cMIME = false;
  try
  {
   if (!!request.contentType)
    cMIME = request.contentType;
  }
  catch (ex)
  {
   cMIME = false;
  }
  if (!!cMIME && cMIME !== this.mime)
  {
   this.replace = false;
   this.cache = false;
   this.mime = cMIME;
   const lMIME = this.mime.toLowerCase();
   this.bypass = decdn_Interceptor._bypassMIME(lMIME);
  }

  if (this.bypass)
  {
   try
   {
    this.originalListener.onStartRequest(request, context);
   }
   catch(ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  if (!!this.mime && (this.mime.includes('html') || this.mime.includes('xml')))
   this.replace = true;

  if (!this.browserID ||
      !decdn_Interceptor.cache.hasOwnProperty(this.browserID) ||
      !decdn_Interceptor.cache[this.browserID].hasOwnProperty(this.dURIs.file.asciiSpec))
  {
   try
   {
    this.originalListener.onStartRequest(request, context);
   }
   catch(ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  const data = decdn_Interceptor._pullFromCache(this.browserID, this.dURIs.file.asciiSpec);
  if (!data)
  {
   try
   {
    this.originalListener.onStartRequest(request, context);
   }
   catch(ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  this.cache = true;

  try
  {
   this.originalListener.onStartRequest(request, context);
  }
  catch(ex)
  {
   request.cancel(ex.result);
   return;
  }

  const storeStream = Components.classes['@mozilla.org/storagestream;1'].createInstance(Components.interfaces.nsIStorageStream);
  storeStream.init(8192, data.length, null);
  const outStream = storeStream.getOutputStream(0);
  if (data.length > 0)
   outStream.write(data, data.length);
  outStream.close();

  try
  {
   this.originalListener.onDataAvailable(request, context, storeStream.newInputStream(0), 0, data.length);
  }
  catch (ex)
  {
   request.cancel(ex.result);
   return;
  }

  try
  {
   this.originalListener.onStopRequest(request, context, 200);
  }
  catch (ex)
  {
   request.cancel(ex.result);
   return;
  }

  request.cancel(0);
 },
 onDataAvailable: function(request, context, inputStream, offset, count)
 {
  if (this.bypass)
  {
   try
   {
    this.originalListener.onDataAvailable(request, context, inputStream, offset, count);
   }
   catch (ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  if (this.cache)
   return;

  if (!this.replace)
  {
   try
   {
    this.originalListener.onDataAvailable(request, context, inputStream, offset, count);
   }
   catch (ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  try
  {
   const bis = Components.classes['@mozilla.org/binaryinputstream;1'].createInstance(Components.interfaces.nsIBinaryInputStream);
   bis.setInputStream(inputStream);
   const data = bis.readBytes(count);
   this.receivedData.push(data);
  }
  catch(ex) {}

  this._checkChunks(request, context);
 },
 onStopRequest: async function(request, context, statusCode)
 {
  if (this.bypass)
  {
   try
   {
    this.originalListener.onStopRequest(request, context, statusCode);
   }
   catch (ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  if (this.cache)
   return;

  if (!this.replace)
  {
   try
   {
    this.originalListener.onStopRequest(request, context, statusCode);
   }
   catch (ex)
   {
    request.cancel(ex.result);
   }
   return;
  }

  let data = this.receivedData.join('');
  data = decdn_Interceptor._replaceContent(data, this.dURIs);

  const storeStream = Components.classes['@mozilla.org/storagestream;1'].createInstance(Components.interfaces.nsIStorageStream);
  storeStream.init(8192, data.length, null);
  const outStream = storeStream.getOutputStream(0);
  if (data.length > 0)
   outStream.write(data, data.length);
  outStream.close();

  try
  {
   this.originalListener.onDataAvailable(request, context, storeStream.newInputStream(0), 0, data.length);
  }
  catch (ex)
  {
   request.cancel(ex.result);
   return;
  }

  try
  {
   this.originalListener.onStopRequest(request, context, statusCode);
  }
  catch (ex)
  {
   request.cancel(ex.result);
  }
 },
 _checkChunks: function(request, context)
 {
  let safeCut = -1;
  let data = this.receivedData.join('');

  const hasEndScript = Array.from(data.matchAll(decdn_Interceptor.reg.endScript));
  if (hasEndScript.length > 0)
  {
   const lastEnd = hasEndScript.pop();
   safeCut = Math.max(safeCut, lastEnd.indices[0][1]);
   this.importmapping = false;
  }
  if (this.importmapping)
   return;

  const hasBeginScript = Array.from(data.matchAll(decdn_Interceptor.reg.beginScript));
  if (hasBeginScript.length > 0)
  {
   const lastBegin = hasBeginScript.pop();
   if (safeCut < lastBegin.indices[0][1])
   {
    const sTag = data.slice(lastBegin.indices[0][0], lastBegin.indices[0][1]);
    if (decdn_Interceptor.reg.attrMap.test(sTag))
    {
     this.importmapping = true;
     return;
    }
    safeCut = lastBegin.indices[0][1];
   }
  }

  const hasLink = Array.from(data.matchAll(decdn_Interceptor.reg.wholeLink));
  if (hasLink.length > 0)
  {
   const lastLink = hasLink.pop();
   safeCut = Math.max(safeCut, lastLink.indices[0][1]);
  }

  let sFind = '<script';
  safeCut = Math.max(safeCut, data.lastIndexOf(sFind));
  while (sFind.length > 0)
  {
   if (!data.endsWith(sFind))
   {
    sFind = sFind.slice(0, -1);
    continue;
   }
   safeCut = Math.max(safeCut, data.length - sFind.length);
   break;
  }

  sFind = '<link';
  safeCut = Math.max(safeCut, data.lastIndexOf(sFind));
  while (sFind.length > 0)
  {
   if (!data.endsWith(sFind))
   {
    sFind = sFind.slice(0, -1);
    continue;
   }
   safeCut = Math.max(safeCut, data.length - sFind.length);
   break;
  }

  if (safeCut === 0)
   return;
  this.receivedData = [];
  if (safeCut > 0)
  {
   if (data.length > safeCut)
   {
    this.receivedData.push(data.slice(safeCut));
    data = data.slice(0, safeCut);
   }
  }

  data = decdn_Interceptor._replaceContent(data, this.dURIs);

  const storeStream = Components.classes['@mozilla.org/storagestream;1'].createInstance(Components.interfaces.nsIStorageStream);
  storeStream.init(8192, data.length, null);
  const outStream = storeStream.getOutputStream(0);
  if (data.length > 0)
   outStream.write(data, data.length);
  outStream.close();

  try
  {
   this.originalListener.onDataAvailable(request, context, storeStream.newInputStream(0), 0, data.length);
  }
  catch (ex)
  {
   request.cancel(ex.result);
  }
 },
 QueryInterface: function (aIID)
 {
  if (aIID.equals(Components.interfaces.nsIStreamListener) || aIID.equals(Components.interfaces.nsISupports))
   return this;
  throw Components.results.NS_NOINTERFACE;
 }
};

window.addEventListener('load', decdn_Interceptor.LoadListener, {capture: false, passive: true, once: true});
