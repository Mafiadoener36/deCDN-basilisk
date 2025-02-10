var decdn_Parser = {
 IGNORED: [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
 ],
 REDIRS: {
  'resources/font-awesome/3.2.1/css/all.min.css': 'resources/font-awesome/3.2.1/css/font-awesome.min.css',
  'resources/font-awesome/3.2.1/css/all.css': 'resources/font-awesome/3.2.1/css/font-awesome.min.css',
  'resources/font-awesome/4.7.0/css/all.min.css': 'resources/font-awesome/4.7.0/css/font-awesome.min.css',
  'resources/font-awesome/4.7.0/css/all.css': 'resources/font-awesome/4.7.0/css/font-awesome.min.css'
 },
 jaxLists: [],
 process: function(sURI)
 {
  const sURL = decdn_URITools.getURLfromURI(sURI);
  if (!sURL)
   return false;
  const sHost = sURL.asciiHost;
  const sPathname = sURL.filePath;
  let sSearch = '';
  if (!!sURL.query)
   sSearch = '?' + sURL.query;
  const cdnHost = decdn_Archive.scripts.mappings.cdn[sHost];
  if (sURL.fileExtension.toLowerCase() === 'map')
   return false;
  const cdnPath = decdn_Parser._findPath(cdnHost, sPathname);
  if (!cdnPath)
   return false;
  const aRes = cdnHost[cdnPath];
  if (!aRes)
   return false;
  return decdn_Parser._find(aRes, cdnPath, sHost, sPathname, sSearch);
 },
 _findPath: function(cdnHost, sPathname)
 {
  for (let p of Object.keys(cdnHost))
  {
   if (sPathname.startsWith(p))
    return p;
  }
  return false;
 },
 _find: function(aRes, cdnPath, host, path, search)
 {
  const regVer = /(?:\d{1,2}\.){1,3}\d{1,2}(?:-\d)?|latest/;
  const regWeird = /\D+@?\d{1,2}\D*/;
  const regBAB = /-(alpha|beta).?\d?/;
  const tmpVer = '{version}';
  let shortPath = path.replace(cdnPath, '');
  if (shortPath.startsWith('bootstrap'))
   shortPath = shortPath.replace(regBAB, '');
  let reqVer = shortPath.match(regVer);
  let matchPath = false;
  if (!reqVer && regWeird.test(path))
  {
   const pathVer = path.match(/\d{1,2}/);
   matchPath = shortPath.replaceAll(pathVer, tmpVer);
   reqVer = [pathVer + '.0'];
  }
  else
   matchPath = shortPath.replaceAll(reqVer, tmpVer);
  const resSpecial = decdn_Archive.scripts.shorthands.specialFiles(host, path, search);
  if (!resSpecial.hasOwnProperty('result') && resSpecial.hasOwnProperty('path'))
  {
   if (!resSpecial.hasOwnProperty('host'))
    resSpecial.host = host;
   return {'source': resSpecial.host, 'versionRequested': 'latest', 'versionDelivered': 'latest', 'path': resSpecial.path};
  }
  if (!matchPath)
   return false;
  for (const mRes of Object.keys(aRes))
  {
   if (!matchPath.startsWith(mRes))
    continue;
   let tPath = aRes[mRes].path;
   tPath = tPath.replaceAll(tmpVer, reqVer);
   let myVer = decdn_Archive.scripts.targets.setLastVersion(tPath, reqVer);
   if (myVer === '')
    break;
   tPath = tPath.replaceAll(reqVer, myVer);
   let wantVer = false;
   if (reqVer === null)
   {
    myVer = tPath.match(regVer).toString();
    wantVer = 'latest';
   }
   else
    wantVer = reqVer[0];
   const sBundle = decdn_Archive.scripts.targets.determineBundle(tPath);
   if (sBundle !== '')
   {
    tPath = decdn_Parser._getPathOfBundle(path, tPath, sBundle);
    if (!tPath)
     break;
    if (sBundle === 'vex (Bundle)' && !tPath.endsWith('.min.css') && tPath.endsWith('.css'))
     tPath = tPath.replace('.css', '.min.css');
    return {'source': host, 'versionRequested': wantVer, 'versionDelivered': myVer, 'path': tPath, 'bundle': sBundle};
   }
   tPath = decdn_Parser._redirTarget(tPath);
   return {'source': host, 'versionRequested': wantVer, 'versionDelivered': myVer, 'path': tPath};
  }
  if (!decdn_Parser.IGNORED.includes(host))
   return 'blockable';
  return false;
 },
 _redirTarget: function(path)
 {
  if (!Object.keys(decdn_Parser.REDIRS).includes(path))
   return path;
  return decdn_Parser.REDIRS[path];
 },
 _getPathOfBundle: function(path, tPath, sBundle)
 {
  const knownBundles = {
   MATHJAX: 'MathJax (Bundle)',
   TINYMCE: 'TinyMCE (Bundle)',
   DATATABLES: 'DataTables (Bundle)',
   SCROLLMAGIC: 'ScrollMagic (Bundle)',
   FONT_AWESOME: 'Font Awesome (Fonts) (Bundle)',
   PURE_CSS: 'Pure CSS (Bundle)',
  };
  let fName = path.split('/').pop();
  switch(sBundle)
  {
   case knownBundles.MATHJAX:
    fName = false;
    break;
   case knownBundles.TINYMCE:
    if (fName !== 'tinymce.min.js')
     fName = decdn_Parser._handleTinyMCE(path);
    break;
   case knownBundles.DATATABLES:
    fName = decdn_Parser._handleUncompressedFiles(fName);
    break;
   case knownBundles.SCROLLMAGIC:
    if (!fName.endsWith('.min.js'))
     fName = decdn_Parser._handleUncompressedFiles(fName);
    break;
   case knownBundles.FONT_AWESOME:
    fName = decdn_Parser._handleFontawesomeFiles(tPath, fName);
    break;
   case knownBundles.PURE_CSS:
    if (fName === 'pure-min.css')
     fName = 'pure.min.css';
    break;
  }
  if (!fName)
   return false;
  if (fName.endsWith('.js'))
   fName += 'm';
  if (tPath.startsWith('resources/element-ui/') && fName.endsWith('.jsm') && !fName.endsWith('.min.jsm'))
   fName = fName.slice(0, -4) + '.min.jsm';
  return tPath + fName;
 },
 _handleMathJax: function(path)
 {
  let fName = path.replace(/\/\w.*(?:\d{1,2}\.){1,3}\d{1,2}(?:-\d)?\/|\/(mathjax\/)?latest\//, '');
  if (fName.startsWith('/npm/mathjax@3'))
   fName = fName.replace('/npm/mathjax@3/', '');
  if (fName === 'config/TeX-AMS_HTML.js')
   fName = 'config/TeX-AMS_HTML-full.js';
  if (fName.endsWith('.js'))
   fName += 'm';
  if (decdn_Parser.jaxLists.length === 0)
   decdn_Parser._getJax();
  if (!decdn_Parser.jaxLists.includes(fName))
   return false;
  return fName;
 },
 _handleTinyMCE: function(path)
 {
  let fName = path.replace(/\/\w.*(?:\d{1,2}\.){1,3}\d{1,2}(?:-\d)?\//, '');
  if (fName.startsWith('plugins/'))
   return false;
  return fName;
 },
 _handleUncompressedFiles: function(fName)
 {
  if (!fName.endsWith('.min.js') && fName.endsWith('.js'))
   return fName.slice(0, -3) + '.min.js';
  if (!fName.endsWith('.min.css') && fName.endsWith('.css'))
   return fName.slice(0, -4) + '.min.css';
  return fName;
 },
 _handleFontawesomeFiles: function(tPath, fName)
 {
  if (tPath === 'resources/font-awesome/4.7.0/fonts/')
   return fName.replace('fontawesome-webfont.woff', 'fontawesome-webfont.woff2');
  return fName;
 },
 _getJax: function()
 {
  const fData = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fData.initWithPath(decdn_Archive.profPath);
  for (let d = 0; d < decdn_Archive.dataPath.length; d++)
  {
   fData.appendRelativePath(decdn_Archive.dataPath[d]);
   if (!fData.exists())
    return false;
  }
  fData.appendRelativePath('resources');
  if (!fData.exists())
   return false;
  fData.appendRelativePath('mathjax');
  if (!fData.exists())
   return false;
  return decdn_Parser._getAllFiles(fData);
 },
 _getAllFiles: function(fData, fLen = 0)
 {
  const items = fData.directoryEntries;
  while (items.hasMoreElements())
  {
   const item = items.getNext().QueryInterface(Components.interfaces.nsILocalFile);
   if (item.isDirectory())
   {
    if (fLen === 0)
     decdn_Parser._getAllFiles(item, item.persistentDescriptor.length);
    else
     decdn_Parser._getAllFiles(item, fLen);
   }
   if (fLen === 0)
    continue;
   if (item.isFile())
    decdn_Parser.jaxLists.push(item.persistentDescriptor.slice(fLen + 1).replaceAll('\\', '/'));
  }
 }
};
