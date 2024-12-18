Components.utils.import('resource://gre/modules/FileUtils.jsm');

var decdn_Data =
{
 getRedirectionURI: function(targetPath)
 {
  const type = decdn_Data._fileToMIME(targetPath);
  const data = decdn_Data._loadResource(targetPath);
  if (!data)
   return false;
  return decdn_Data._buildDataURI(type, data);
 },
 _loadResource: function(targetPath)
 {
  const fData = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fData.initWithPath(decdn_Archive.profPath);
  for (let d = 0; d < decdn_Archive.dataPath.length; d++)
  {
   fData.appendRelativePath(decdn_Archive.dataPath[d]);
   if (!fData.exists())
    return false;
  }
  const lTrim = fData.persistentDescriptor.length;
  const aName = targetPath.split('/');
  if (aName.length > 1)
  {
   for (let d = 0; d < aName.length - 1; d++)
   {
    fData.appendRelativePath(aName[d]);
    if (!fData.exists())
     return false;
   }
  }
  fData.appendRelativePath(aName[aName.length - 1]);
  if (!fData.exists())
   return false;
  const fSize = fData.fileSize;
  if (fSize === 0)
   return false;
  const fIn = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
  fIn.init(fData, -1, 0, 0);
  let eData = new ArrayBuffer(fSize);
  const bis = Components.classes['@mozilla.org/binaryinputstream;1'].createInstance(Components.interfaces.nsIBinaryInputStream);
  bis.setInputStream(fIn);
  bis.readArrayBuffer(fSize, eData);
  bis.close();
  fIn.close();
  if (!aName[aName.length - 1].endsWith('.css'))
   return eData;
  let sData = new TextDecoder().decode(eData);
  const reg = /url\((['"]?\.\.?[^\)]+)\)/g;
  const sReplaced = sData.replaceAll(reg, function(m, p){
   if (p.startsWith('\'') && p.endsWith('\''))
    p = p.slice(1, -1);
   else if (p.startsWith('"') && p.endsWith('"'))
    p = p.slice(1, -1);
   let file = p;
   if (file.includes('#'))
    file = file.slice(0, file.indexOf('#'));
   if (file.includes('?'))
    file = file.slice(0, file.indexOf('?'));
   const aPath = [];
   aPath.push(...decdn_Archive.dataPath);
   if (aName.length > 1)
   {
    aPath.push(...aName);
    aPath.pop();
   }
   aPath.push(...file.split('/'));
   for (let i = aPath.length - 1; i >= 0; i--)
   {
    if (aPath[i] === '.')
    {
     aPath.splice(i, 1);
     continue;
    }
    if (aPath[i] === '..')
    {
     aPath.splice(i - 1, 2);
     continue;
    }
   }
   const fTest = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
   fTest.initWithPath(decdn_Archive.profPath);
   for (let d = 0; d < aPath.length; d++)
   {
    fTest.appendRelativePath(aPath[d]);
    if (!fTest.exists())
     return m;
   }
   const subRes = decdn_Data.getRedirectionURI(fTest.persistentDescriptor.slice(lTrim + 1));
   if (!subRes)
    return m;
   return m.replace(p, subRes.asciiSpec);
  });
  if (!sReplaced)
   return eData;
  return new TextEncoder().encode(sReplaced);
 },
 _buildDataURI: function(type, data)
 {
  if (decdn_Data._isBin(data))
  {
   const bData = decdn_Data._arrayBufferToBase64(data);
   const dataURI = 'data:' + type + ';base64,' + bData;
   return decdn_URITools.makeURI(dataURI);
  }
  const strData = '/* Intercepted by deCDN */\n\n' + new TextDecoder().decode(data);
  const strURI = 'data:' + type + ';charset=utf-8,' + encodeURIComponent(strData);
  return decdn_URITools.makeURI(strURI);
 },
 _isBin: function(data)
 {
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.byteLength; i++)
  {
   const pt = bytes[i];
   if (pt < 9)
    return true;
   if (pt === 11 || pt === 12)
    return true;
   if (pt > 13 && pt < 32)
    return true;
   if (pt > 126 && pt < 160)
    return true;
  }
  return false;
 },
 _fileToMIME: function(path)
 {
  let fExt = path;
  if (fExt.lastIndexOf('/') > -1)
   fExt = fExt.slice(fExt.lastIndexOf('/') + 1);
  if (fExt.lastIndexOf('.') > -1)
   fExt = fExt.slice(fExt.lastIndexOf('.') + 1);
  fExt = fExt.toLowerCase();
  switch (fExt)
  {
   case 'html': return 'text/html';
   case 'css': return 'text/css';
   case 'gif': return 'image/gif';
   case 'jpeg':
   case 'jpg':
   case 'jpe':
    return 'image/jpeg';
   case 'png': return 'image/png';
   case 'svg': return 'image/svg+xml';
   case 'ico': return 'image/vnd.microsoft.icon';
   case 'js':
   case 'jsm':
    return 'text/javascript';
   case 'css': return 'text/css';
   case 'woff': return 'font/woff';
   case 'woff2': return 'font/woff2';
   case 'md': return 'text/plain';
  }
  return 'application/octet-string';
 },
 _arrayBufferToBase64: function(buffer)
 {
  let binary = '';
  let bytes = new Uint8Array(buffer);
  let len = bytes.byteLength;
  for(let i = 0; i < len; i++)
  {
   binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
 }
};
