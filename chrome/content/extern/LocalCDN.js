// for compatibility with target.js and shorthand.js

const Regex = {
 GOOGLE_MATERIAL_ICONS: /fonts\.(googleapis|gstatic)\.com\/.*\?family=.*Material\+Icons/,
 JSDELIVR_COMBINE: /cdn\.jsdelivr\.net.*\/combine.*jquery.*hogan.*algoliasearch.*autocomplete.*/,
 BOOTSTRAP_DATEPICKER_3: /\/bootstrap-datepicker3.*\.css/,
 BOOTSTRAP_DATEPICKER: /\/bootstrap-datepicker.*\.css/,
 FONT_AWESOME: /use\.fontawesome\.com\/fa-loader\.css/,
 FONT_AWESOME_WITH_CODE: /use\.fontawesome\.com\/[a-z0-9]{10}\.(js|css)/,
 FONT_AWESOME_FONTS_ONLY: /\/font-?awesome\/(?:\d{1,2}\.){1,3}\d{1,2}\/fonts\//,
 BOOTSTRAP_FONTS_ONLY: /\/bootstrap\/(?:\d{1,2}\.){1,3}\d{1,2}\/fonts\//,
 ROCKET_LOADER: /ajax\.cloudflare\.com\/cdn-cgi\/scripts\/[a-zA-Z0-9]{8}\/cloudflare-static\/rocket-loader\.min\.js/,
 DOCSIFY: /docsify@(?:\d{1,2}\.){0,3}\d{1,2}(?:-\d)?$/
};

const MaterialIcons = {
 DEFAULT: 'flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2'
};

var helpers = {};

helpers.extractFilenameFromPath = function(sPath)
{
 const aPath = sPath.split('/');
 const aFile = aPath[aPath.length - 1];
 if (aFile === '')
  return aPath[1];
 return aFile;
};

helpers.compareVersion = function(s1, s2)
{
 const v1 = s1.split('.');
 const v2 = s2.split('.');
 const l = Math.min(v1.length, v2.length);
 for (let i = 0; i < l; i++)
 {
  v1[i] = parseInt(v1[i], 10);
  v2[i] = parseInt(v2[i], 10);
  if (v1[i] < v2[i])
   return false;
  if (v1[i] > v2[i])
   return true;
 }
 if (v1.length < v2.length)
  return false;
 if (v1.length === v2.length)
  return true;
 return true;
};
