var decdn_URITools = {
 makeURI: function(path, hostURI = null)
 {
  const ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  try
  {
   return ioService.newURI(path, null, hostURI);
  }
  catch(ex)
  {
   return false;
  }
 },
 getURLfromURI: function(uri)
 {
  try
  {
   return uri.QueryInterface(Components.interfaces.nsIURL);
  }
  catch (ex)
  {
   return false;
  }
 }
};
