var decdn_Prefs = {
 _locale: Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://decdn/locale/prefs.properties'),
 _svcIO: Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),
 _svcIco: Components.classes['@mozilla.org/browser/favicon-service;1'].getService(Components.interfaces.nsIFaviconService).QueryInterface(Components.interfaces.mozIAsyncFavicons),
 _commit: '',
 _branch: 'main',
 mHostView:
 {
  hostList: {},
  iconList: {},
  sortCol: 'colSiteHost',
  sortOrder: 1,
  get rowCount() { return Object.keys(this.hostList).length; },
  get _hostKeys()
  {
   if (this.sortCol === 'colSiteHost')
   {
    let kList = Object.keys(this.hostList);
    kList.sort();
    if (this.sortOrder < 0)
     kList.reverse();
    return kList;
   }
   const aGroups = {};
   for (const host in this.hostList)
   {
    const val = this.hostList[host];
    if (!aGroups.hasOwnProperty(val))
     aGroups[val] = [];
    aGroups[val].push(host);
   }
   for (const g in aGroups)
   {
    aGroups[g].sort();
    if (this.sortOrder < 0)
     aGroups[g].reverse();
   }
   const kOrd = [decdn_CONSTS.ACTION.OPTION.BYPASS, decdn_CONSTS.ACTION.OPTION.BYPASSMISSING, decdn_CONSTS.ACTION.OPTION.BLOCKMISSING];
   if (this.sortOrder < 0)
    kOrd.reverse();
   const kRet = [];
   for (let i = 0; i < kOrd.length; i++)
   {
    if (!aGroups.hasOwnProperty(kOrd[i]))
     continue;
    kRet.push(...aGroups[kOrd[i]]);
   }
   return kRet;
  },
  draw: function()
  {
   const lstHosts = document.getElementById('lstHosts');

   const selHosts = [];
   for (let i = 0; i < lstHosts.selectedItems.length; i++)
   {
    selHosts.push(lstHosts.selectedItems[i].getAttribute('value'));
   }

   while (lstHosts.getRowCount() > 0)
   {
    lstHosts.removeItemAt(0);
   }
   const scopes = [decdn_CONSTS.ACTION.OPTION.BYPASS, decdn_CONSTS.ACTION.OPTION.BYPASSMISSING, decdn_CONSTS.ACTION.OPTION.BLOCKMISSING];
   for (let i = 0; i < this.rowCount; i++)
   {
    const sHost = this._hostKeys[i];

    const row = document.createElement('listitem');
    row.setAttribute('allowevents', true);
    row.setAttribute('value', sHost);

    const cellSite = document.createElement('listcell');
    cellSite.setAttribute('label', sHost);
    cellSite.setAttribute('class', 'listcell-iconic');
    if (this.iconList.hasOwnProperty(sHost))
     cellSite.setAttribute('image', this.iconList[sHost]);
    else
     cellSite.setAttribute('image', 'moz-anno:favicon:about:blank');
    row.appendChild(cellSite);

    const cellScope = document.createElement('menulist');
    const mnuScope = document.createElement('menupopup');
    for (let s = 0; s < scopes.length; s++)
    {
     const mnuItem = document.createElement('menuitem');
     mnuItem.setAttribute('label', decdn_Prefs._locale.GetStringFromName('access.' + scopes[s]));
     mnuItem.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.' + scopes[s] + '.tooltip'));
     mnuItem.setAttribute('value', scopes[s]);
     if (this.hostList[sHost] === scopes[s])
      mnuItem.setAttribute('selected', true);
     mnuScope.appendChild(mnuItem);
    }
    cellScope.appendChild(mnuScope);
    cellScope.addEventListener('command', function(){
     decdn_Prefs.mHostView.hostList[sHost] = cellScope.value;
     decdn_Prefs.mHostView.draw();
     decdn_Prefs.updatePrefs();
    });

    row.appendChild(cellScope);

    lstHosts.appendChild(row);
    if (selHosts.includes(sHost))
    {
     lstHosts.ensureElementIsVisible(row);
     lstHosts.addItemToSelection(row);
    }
   }
   if (this.rowCount > 0)
    lstHosts.scrollToIndex(0);

   if (this.sortCol === 'colSiteHost')
   {
    document.getElementById('colSiteScopeHdr').removeAttribute('sortDirection');
    if (this.sortOrder > 0)
     document.getElementById('colSiteHostHdr').setAttribute('sortDirection', 'descending');
    else
     document.getElementById('colSiteHostHdr').setAttribute('sortDirection', 'ascending');
   }
   else
   {
    document.getElementById('colSiteHostHdr').removeAttribute('sortDirection');
    if (this.sortOrder > 0)
     document.getElementById('colSiteScopeHdr').setAttribute('sortDirection', 'descending');
    else
     document.getElementById('colSiteScopeHdr').setAttribute('sortDirection', 'ascending');
   }
  },
  genIconList: async function()
  {
   this.iconList = {};
   for (const host in this.hostList)
   {
    this.iconList[host] = await this._getIcon(host);
   }
  },
  _getIcon: function(host, scheme = 'https')
  {
   return new Promise(
    function(resolve)
    {
     const uri = decdn_Prefs._svcIO.newURI(scheme + '://' + host, null, null);
     decdn_Prefs._svcIco.getFaviconURLForPage(uri,
      function(aURI)
      {
       if (aURI === null)
       {
        if (scheme === 'http')
        {
         resolve('moz-anno:favicon:about:blank');
         return;
        }
        resolve(decdn_Prefs.mHostView._getIcon(host, 'http'));
        return;
       }
       const lnk = decdn_Prefs._svcIco.getFaviconLinkForIcon(aURI);
       if (lnk === null)
       {
        if (scheme === 'http')
        {
         resolve('moz-anno:favicon:about:blank');
         return;
        }
        resolve(decdn_Prefs.mHostView._getIcon(host, 'http'));
        return;
       }
       resolve(lnk.asciiSpec);
      }
     );
    }
   );
  },
  onSelAll: function(ev)
  {
   const lstHosts = document.getElementById('lstHosts');
   if (ev.target.checked)
    lstHosts.selectAll();
   else
    lstHosts.clearSelection();
  },
  onScopeKeyPress: function(aEvent)
  {
   if (aEvent.keyCode === KeyEvent.DOM_VK_RETURN)
   {
    document.getElementById('cmdSiteScope').click();
    aEvent.preventDefault();
   }
  },
  onSetSelScope: function()
  {
   const cmbSiteScope = document.getElementById('cmbSiteScope');
   const lstHosts = document.getElementById('lstHosts');
   for (let i = 0; i < lstHosts.selectedItems.length; i++)
   {
    const host = lstHosts.selectedItems[i].getAttribute('value');
    this.hostList[host] = cmbSiteScope.value;
   }
   this.draw();
   decdn_Prefs.updatePrefs();
  },
  onListSelected: function()
  {
   document.getElementById('cmdRemoveAll').disabled = this.rowCount === 0;
   if (this.rowCount === 0)
   {
    document.getElementById('cmdRemove').disabled = true;
    document.getElementById('cmdSiteScope').disabled = true;
    document.getElementById('chkSiteSel').disabled = true;
    document.getElementById('chkSiteSel').checked = false;
    return;
   }
   const lstHosts = document.getElementById('lstHosts');
   document.getElementById('cmdRemove').disabled = lstHosts.selectedCount === 0;
   document.getElementById('cmdSiteScope').disabled = lstHosts.selectedCount === 0;
   document.getElementById('chkSiteSel').checked = lstHosts.selectedCount === this.rowCount;
   document.getElementById('chkSiteSel').disabled = false;
  },
  onListKeyPress: function(aEvent)
  {
   if (aEvent.keyCode === KeyEvent.DOM_VK_DELETE)
   {
    document.getElementById('cmdRemove').click();
    aEvent.preventDefault();
   }
   if (aEvent.code === 'KeyA' && aEvent.ctrlKey && !aEvent.altKey && !aEvent.metaKey)
   {
    if (aEvent.shiftKey)
     document.getElementById('lstHosts').clearSelection();
    else
     document.getElementById('lstHosts').selectAll();
    aEvent.preventDefault();
   }
  },
  onListSort: function(col)
  {
   if (this.sortCol === col)
    this.sortOrder *= -1;
   else
   {
    this.sortCol = col;
    this.sortOrder = 1;
   }
   this.draw();
  },
  onTextInput: function(aSiteField)
  {
   document.getElementById('cmdBypass').disabled = !aSiteField.value;
  },
  onTextKeyPress: function(aEvent)
  {
   if (aEvent.keyCode === KeyEvent.DOM_VK_RETURN)
   {
    document.getElementById('cmdBypass').click();
    aEvent.preventDefault();
   }
  },
  onAddClick: async function()
  {
   const txtSite = document.getElementById('txtSite');
   let host = txtSite.value.replace(/^\s*([-\w]*:\/+)?/, ''); // trim any leading space and scheme
   host = (host.charAt(0) === '.') ? host.substring(1,host.length) : host;
   try
   {
    const uri = decdn_Prefs._svcIO.newURI('http://' + host, null, null);
    host = uri.asciiHost;
   }
   catch(ex)
   {
    return;
   }
   if (!this.hostList.hasOwnProperty(host))
   {
    let cmbScope = document.getElementById('cmbNewSiteScope');
    if (cmbScope.collapsed)
     this.hostList[host] = decdn_CONSTS.ACTION.OPTION.BYPASS;
    else
     this.hostList[host] = cmbScope.value;
    this.iconList[host] = await this._getIcon(host);
    this.draw();
   }
   decdn_Prefs.updatePrefs();
   txtSite.value = '';
   txtSite.focus();
   document.getElementById('cmdBypass').disabled = true;
   document.getElementById('cmdRemoveAll').disabled = this.rowCount === 0;
  },
  onRemSelClick: function()
  {
   document.getElementById('cmdRemove').disabled = true;
   document.getElementById('cmdRemoveAll').disabled = true;
   document.getElementById('cmdSiteScope').disabled = true;
   const lstHosts = document.getElementById('lstHosts');
   for (let i = 0; i < lstHosts.selectedItems.length; i++)
   {
    const host = lstHosts.selectedItems[i].getAttribute('value');
    delete this.hostList[host];
    delete this.iconList[host];
   }
   lstHosts.clearSelection();
   this.draw();
   document.getElementById('cmdRemoveAll').disabled = this.rowCount === 0;
   decdn_Prefs.updatePrefs();
  },
  onRemAllClick: function()
  {
   document.getElementById('cmdRemove').disabled = true
   document.getElementById('cmdRemoveAll').disabled = true;
   document.getElementById('cmdSiteScope').disabled = true;
   this.hostList = {};
   this.iconList = {};
   this.draw();
   decdn_Prefs.updatePrefs();
  }
 },
 mCDNView:
 {
  cdnList: {},
  sortCol: 'colCDN',
  sortOrder: 1,
  get rowCount()
  {
   const sFilter = document.getElementById('txtCDNSearch').value;
   if (!sFilter || sFilter.length < 1)
    return this.cdnCount;
   let newCt = 0;
   for (let i = 0; i < this.cdnCount; i++)
   {
    if (this.cdnList[i].host.includes(sFilter))
     newCt++;
   }
   return newCt;
  },
  getHostOfRow: function(idx)
  {
   const sFilter = document.getElementById('txtCDNSearch').value;
   if (!sFilter || sFilter.length < 1)
    return this.cdnList[idx].host;
   let newCt = 0;
   for (let i = 0; i < this.cdnCount; i++)
   {
    if (!this.cdnList[i].host.includes(sFilter))
     continue;
    if (newCt === idx)
     return this.cdnList[i].host;
    newCt++;
   }
   return false;
  },
  getValueOfRow: function(idx)
  {
   const sFilter = document.getElementById('txtCDNSearch').value;
   if (!sFilter || sFilter.length < 1)
    return this.cdnList[idx].value;
   let newCt = 0;
   for (let i = 0; i < this.cdnCount; i++)
   {
    if (!this.cdnList[i].host.includes(sFilter))
     continue;
    if (newCt === idx)
     return this.cdnList[i].value;
    newCt++;
   }
   return false;
  },
  setValueOfRow: function(idx, value)
  {
   const sFilter = document.getElementById('txtCDNSearch').value;
   if (!sFilter || sFilter.length < 1)
   {
    this.cdnList[idx].value = value;
    return;
   }
   let newCt = 0;
   for (let i = 0; i < this.cdnCount; i++)
   {
    if (!this.cdnList[i].host.includes(sFilter))
     continue;
    if (newCt === idx)
    {
     this.cdnList[i].value = value;
     return;
    }
    newCt++;
   }
  },
  get cdnCount() { return Object.keys(this.cdnList).length; },
  isContainer: function(row) { return false; },
  isSeparator: function(row) { return false; },
  isSorted: function() { return true; },
  getLevel: function(row) { return 0; },
  getImageSrc: function(row,col) { return null; },
  getRowProperties: function(row,props) {},
  getColumnProperties: function(colid,col,props) {},
  setTree: function(treebox) { this.treebox = treebox; },
  populateHostList: function(prefs)
  {
   this.cdnList = {};
   const brw = decdn_Prefs._getBrowser();
   if (!brw)
    return;
   if (!brw.decdn_Archive.scripts.hasOwnProperty('mappings'))
    return;
   if (!brw.decdn_Archive.scripts.mappings.hasOwnProperty('cdn'))
    return;
   let idx = 0;
   for (const host in brw.decdn_Archive.scripts.mappings.cdn)
   {
    let v = decdn_CONSTS.ACTION.OPTION.BYPASSMISSING;
    if (prefs.hasOwnProperty(host))
     v = prefs[host];
    this.cdnList[idx++] = {
     value: v,
     host: host,
     domain: this._getDomain(host)
    };
   }
   this._reorderList();
  },
  isEditable: function(aRow, aCol)
  {
   return aCol.index === 0;
  },
  getCellText: function (aRow, aCol)
  {
   if (aCol.index === 1)
    return this.getHostOfRow(aRow);
   if (aCol.index === 2)
   {
    try
    {
     return decdn_Prefs._locale.GetStringFromName('cdn.' + this.getValueOfRow(aRow));
    }
    catch (ex)
    {
     return decdn_Prefs._locale.GetStringFromName('cdn.bypassmissing')
    }
   }
   return '';
  },
  getCellValue: function (aRow, aCol)
  {
   if (aCol.index === 0)
    return this.getValueOfRow(aRow) !== decdn_CONSTS.ACTION.OPTION.BYPASSMISSING;
   return false;
  },
  setCellValue: function(aRow, aCol, value)
  {
   this.treebox.beginUpdateBatch();
   if (this.selection.isSelected(aRow))
   {
    for (let i = 0; i < this.rowCount; i++)
    {
     if (!this.selection.isSelected(i))
      continue;
     if (value === 'true')
      this.setValueOfRow(i, decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
     else
      this.setValueOfRow(i, decdn_CONSTS.ACTION.OPTION.BYPASSMISSING);
    }
   }
   else
   {
    if (value === 'true')
     this.setValueOfRow(aRow, decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
    else
     this.setValueOfRow(aRow, decdn_CONSTS.ACTION.OPTION.BYPASSMISSING);
   }
   this._reorderList();
   this.treebox.endUpdateBatch();
   this.updateCheckState();
   decdn_Prefs.updatePrefs();
  },
  getCellProperties: function(row, column) { return 'ltr'; },
  cycleHeader: function(aCol)
  {
   if (aCol.index === 0)
   {
    this.toggleAll();
    return;
   }
   this.treebox.beginUpdateBatch();
   if (this.sortCol === aCol.id)
    this.sortOrder *= -1;
   else
   {
    this.sortCol = aCol.id;
    this.sortOrder = 1;
   }
   this._reorderList();
   this.treebox.endUpdateBatch();
  },
  allState: function()
  {
   let allOne = null;
   for (let i = 0; i < this.rowCount; i++)
   {
    if (allOne === null)
     allOne = this.getValueOfRow(i) === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING;
    else
    {
     if (allOne !== (this.getValueOfRow(i) === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING))
      return null;
    }
   }
   return allOne;
  },
  toggleAll: function()
  {
   let allOne = this.allState();
   if (allOne === null)
    allOne = true;
   this.treebox.beginUpdateBatch();
   for (let i = 0; i < this.rowCount; i++)
   {
    if (allOne === true || allOne === null)
    {
     if (this.getValueOfRow(i) === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      this.setValueOfRow(i, decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
    }
    else
     this.setValueOfRow(i, decdn_CONSTS.ACTION.OPTION.BYPASSMISSING);
   }
   this._reorderList();
   this.treebox.endUpdateBatch();
   this.updateCheckState();
   decdn_Prefs.updatePrefs();
  },
  onSelAll: function(ev)
  {
   if (ev.target.checked)
    this.selection.selectAll();
   else
    this.selection.clearSelection();
  },
  onTreeSelected: function()
  {
   let bAll = null;
   for (let i = 0; i < this.rowCount; i++)
   {
    if (bAll === null)
     bAll = this.selection.isSelected(i);
    else
    {
     if (bAll !== this.selection.isSelected(i))
     {
      bAll = null;
      break;
     }
    }
   }
   document.getElementById('chkCDNSel').checked = bAll === true;
  },
  filter: function()
  {
   if (!!this.selection)
    this.selection.clearSelection();
   this.treebox.beginUpdateBatch();
   this.treebox.invalidate();
   this._reorderList();
   this.treebox.endUpdateBatch();
   this.updateCheckState();
  },
  _reorderList: function()
  {
   const selList = [];
   if (!!this.selection)
   {
    for (let i = 0; i < this.rowCount; i++)
    {
     if (!this.selection.isSelected(i))
      continue;
     selList.push(this.getHostOfRow(i));
    }
   }
   let unordered = Object.values(this.cdnList);
   if (this.sortCol === 'colCDNState')
   {
    document.getElementById('colCDN').removeAttribute('sortDirection');
    if (this.sortOrder > 0)
     document.getElementById('colCDNState').setAttribute('sortDirection', 'descending');
    else
     document.getElementById('colCDNState').setAttribute('sortDirection', 'ascending');
    unordered.sort(this._sortByVDH);
   }
   else
   {
    document.getElementById('colCDNState').removeAttribute('sortDirection');
    if (this.sortOrder > 0)
     document.getElementById('colCDN').setAttribute('sortDirection', 'descending');
    else
     document.getElementById('colCDN').setAttribute('sortDirection', 'ascending');
    unordered.sort(this._sortByDH);
   }
   if (this.sortOrder < 0)
    unordered.reverse();
   this.cdnList = {};
   for (let i = 0; i < unordered.length; i++)
   {
    this.cdnList[i] = unordered[i];
   }
   if (!!this.selection)
   {
    this.selection.clearSelection();
    if (selList.length > 0)
    {
     for (let i = 0; i < this.rowCount; i++)
     {
      if (selList.includes(this.getHostOfRow(i)))
       this.selection.rangedSelect(i, i, true);
     }
    }
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
  _sortByVDH: function(a, b)
  {
   if (a.value !== b.value)
   {
    if (a.value === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
     return -1;
    return 1;
   }
   const d = a.domain.localeCompare(b.domain);
   if (d !== 0)
    return d;
   return a.host.localeCompare(b.host);
  },
  _sortByDH: function(a, b)
  {
   const d = a.domain.localeCompare(b.domain);
   if (d !== 0)
    return d;
   return a.host.localeCompare(b.host);
  },
  updateCheckState: function()
  {
   const allOne = decdn_Prefs.mCDNView.allState();
   const colCDNChk = document.getElementById('colCDNChk');
   if (allOne === true)
   {
    colCDNChk.classList.add('none');
    colCDNChk.classList.remove('some');
   }
   else if (allOne === null)
   {
    colCDNChk.classList.add('some');
    colCDNChk.classList.remove('none');
   }
   else
   {
    colCDNChk.classList.remove('none');
    colCDNChk.classList.remove('some');
   }
  }
 },
 mFontView:
 {
  fontList: [],
  iconList: {},
  sortCol: 'colFontHost',
  sortOrder: 1,
  get rowCount() { return this.fontList.length; },
  get _hostKeys()
  {
   let kList = JSON.parse(JSON.stringify(this.fontList));
   kList.sort();
   if (this.sortOrder < 0)
    kList.reverse();
   return kList;
  },
  draw: function()
  {
   const lstFonts = document.getElementById('lstFonts');

   const selFonts = [];
   for (let i = 0; i < lstFonts.selectedItems.length; i++)
   {
    selFonts.push(lstFonts.selectedItems[i].getAttribute('value'));
   }

   while (lstFonts.getRowCount() > 0)
   {
    lstFonts.removeItemAt(0);
   }
   for (let i = 0; i < this.rowCount; i++)
   {
    const sHost = this._hostKeys[i];

    const row = document.createElement('listitem');
    row.setAttribute('allowevents', true);
    row.setAttribute('value', sHost);

    const cellSite = document.createElement('listcell');
    cellSite.setAttribute('label', sHost);
    cellSite.setAttribute('class', 'listcell-iconic');
    if (this.iconList.hasOwnProperty(sHost))
     cellSite.setAttribute('image', this.iconList[sHost]);
    else
     cellSite.setAttribute('image', 'moz-anno:favicon:about:blank');
    row.appendChild(cellSite);

    lstFonts.appendChild(row);
    if (selFonts.includes(sHost))
    {
     lstFonts.ensureElementIsVisible(row);
     lstFonts.addItemToSelection(row);
    }
   }
   if (this.rowCount > 0)
    lstFonts.scrollToIndex(0);

   if (this.sortOrder > 0)
    document.getElementById('colFontHostHdr').setAttribute('sortDirection', 'descending');
   else
    document.getElementById('colFontHostHdr').setAttribute('sortDirection', 'ascending');
  },
  genIconList: async function()
  {
   this.iconList = {};
   for (let i = 0; i < this.rowCount; i++)
   {
    this.iconList[this.fontList[i]] = await this._getIcon(this.fontList[i]);
   }
  },
  _getIcon: function(host, scheme = 'https')
  {
   return new Promise(
    function(resolve)
    {
     const uri = decdn_Prefs._svcIO.newURI(scheme + '://' + host, null, null);
     decdn_Prefs._svcIco.getFaviconURLForPage(uri,
      function(aURI)
      {
       if (aURI === null)
       {
        if (scheme === 'http')
        {
         resolve('moz-anno:favicon:about:blank');
         return;
        }
        resolve(decdn_Prefs.mHostView._getIcon(host, 'http'));
        return;
       }
       const lnk = decdn_Prefs._svcIco.getFaviconLinkForIcon(aURI);
       if (lnk === null)
       {
        if (scheme === 'http')
        {
         resolve('moz-anno:favicon:about:blank');
         return;
        }
        resolve(decdn_Prefs.mHostView._getIcon(host, 'http'));
        return;
       }
       resolve(lnk.asciiSpec);
      }
     );
    }
   );
  },
  onSelAll: function(ev)
  {
   const lstFonts = document.getElementById('lstFonts');
   if (ev.target.checked)
    lstFonts.selectAll();
   else
    lstFonts.clearSelection();
  },
  onListSelected: function()
  {
   document.getElementById('cmdFontRemoveAll').disabled = this.rowCount === 0;
   if (this.rowCount === 0)
   {
    document.getElementById('cmdFontRemove').disabled = true;
    document.getElementById('chkFontSel').disabled = true;
    document.getElementById('chkFontSel').checked = false;
    return;
   }
   const lstFonts = document.getElementById('lstFonts');
   document.getElementById('cmdFontRemove').disabled = lstFonts.selectedCount === 0;
   document.getElementById('chkFontSel').checked = lstFonts.selectedCount === this.rowCount;
   document.getElementById('chkFontSel').disabled = false;
  },
  onListKeyPress: function(aEvent)
  {
   if (aEvent.keyCode === KeyEvent.DOM_VK_DELETE)
   {
    document.getElementById('cmdFontRemove').click();
    aEvent.preventDefault();
   }
   if (aEvent.code === 'KeyA' && aEvent.ctrlKey && !aEvent.altKey && !aEvent.metaKey)
   {
    if (aEvent.shiftKey)
     document.getElementById('lstFonts').clearSelection();
    else
     document.getElementById('lstFonts').selectAll();
    aEvent.preventDefault();
   }
  },
  onListSort: function(col)
  {
   if (this.sortCol === col)
    this.sortOrder *= -1;
   else
   {
    this.sortCol = col;
    this.sortOrder = 1;
   }
   this.draw();
  },
  onTextInput: function(aSiteField)
  {
   document.getElementById('cmdFontBypass').disabled = !aSiteField.value;
  },
  onTextKeyPress: function(aEvent)
  {
   if (aEvent.keyCode === KeyEvent.DOM_VK_RETURN)
   {
    document.getElementById('cmdFontBypass').click();
    aEvent.preventDefault();
   }
  },
  onAddClick: async function()
  {
   const txtSite = document.getElementById('txtFontSite');
   let host = txtSite.value.replace(/^\s*([-\w]*:\/+)?/, ''); // trim any leading space and scheme
   host = (host.charAt(0) === '.') ? host.substring(1,host.length) : host;
   try
   {
    const uri = decdn_Prefs._svcIO.newURI('http://' + host, null, null);
    host = uri.asciiHost;
   }
   catch(ex)
   {
    return;
   }
   if (!this.fontList.includes(host))
   {
    this.fontList.push(host);
    this.iconList[host] = await this._getIcon(host);
    this.draw();
   }
   decdn_Prefs.updatePrefs();
   txtSite.value = '';
   txtSite.focus();
   document.getElementById('cmdFontBypass').disabled = true;
   document.getElementById('cmdFontRemoveAll').disabled = this.rowCount === 0;
  },
  onRemSelClick: function()
  {
   document.getElementById('cmdFontRemove').disabled = true;
   document.getElementById('cmdFontRemoveAll').disabled = true;
   const lstFonts = document.getElementById('lstFonts');
   for (let i = 0; i < lstFonts.selectedItems.length; i++)
   {
    const host = lstFonts.selectedItems[i].getAttribute('value');
    this.fontList = this.fontList.filter(function(el){return el !== host;});
    delete this.iconList[host];
   }
   lstFonts.clearSelection();
   this.draw();
   document.getElementById('cmdFontRemoveAll').disabled = this.rowCount === 0;
   decdn_Prefs.updatePrefs();
  },
  onRemAllClick: function()
  {
   document.getElementById('cmdFontRemove').disabled = true
   document.getElementById('cmdFontRemoveAll').disabled = true;
   this.fontList = [];
   this.iconList = {};
   this.draw();
   decdn_Prefs.updatePrefs();
  }
 },
 init: async function()
 {
  decdn_Prefs._updateFonts();
  document.getElementById('tabCDNs').collapsed = true;
  document.getElementById('lblDowngradeDesc1').collapsed = false;
  document.getElementById('lblDowngradeDesc2').collapsed = true;
  document.getElementById('lblBranchChanged').setAttribute('style', 'visibility: hidden;');

  const cmbSiteScope = document.getElementById('cmbSiteScope');
  cmbSiteScope.removeAllItems();
  const a0 = cmbSiteScope.appendItem(decdn_Prefs._locale.GetStringFromName('access.bypass'), decdn_CONSTS.ACTION.OPTION.BYPASS);
  a0.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.bypass.tooltip'));
  const a1 = cmbSiteScope.appendItem(decdn_Prefs._locale.GetStringFromName('access.bypassmissing'), decdn_CONSTS.ACTION.OPTION.BYPASSMISSING);
  a1.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.bypassmissing.tooltip'));
  const a2 = cmbSiteScope.appendItem(decdn_Prefs._locale.GetStringFromName('access.blockmissing'), decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
  a2.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.blockmissing.tooltip'));
  cmbSiteScope.selectedIndex = 0;

  const cmdBypass = document.getElementById('cmdBypass');
  cmdBypass.label = decdn_Prefs._locale.GetStringFromName('button.' + decdn_CONSTS.ACTION.OPTION.BYPASS);
  const cmbNewSiteScope = document.getElementById('cmbNewSiteScope');
  cmbNewSiteScope.removeAllItems();
  const b0 = cmbNewSiteScope.appendItem(decdn_Prefs._locale.GetStringFromName('access.bypass'), decdn_CONSTS.ACTION.OPTION.BYPASS);
  b0.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.bypass.tooltip'));
  const b1 = cmbNewSiteScope.appendItem(decdn_Prefs._locale.GetStringFromName('access.bypassmissing'), decdn_CONSTS.ACTION.OPTION.BYPASSMISSING);
  b1.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.bypassmissing.tooltip'));
  const b2 = cmbNewSiteScope.appendItem(decdn_Prefs._locale.GetStringFromName('access.blockmissing'), decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
  b2.setAttribute('tooltiptext', decdn_Prefs._locale.GetStringFromName('access.blockmissing.tooltip'));
  cmbNewSiteScope.selectedIndex = 0;
  cmbNewSiteScope.addEventListener('command', function(){
   cmdBypass.label = decdn_Prefs._locale.GetStringFromName('button.' + cmbNewSiteScope.value);
  });

  const prefBypass = document.getElementById('prefSitesBypass');
  let sHosts = prefBypass.defaultValue;
  if (prefBypass.hasUserValue)
   sHosts = prefBypass.valueFromPreferences;
  try
  {
   decdn_Prefs.mHostView.hostList = JSON.parse(sHosts);
  }
  catch(ex)
  {
   decdn_Prefs.mHostView.hostList = {};
  }
  await decdn_Prefs.mHostView.genIconList();
  decdn_Prefs.mHostView.draw();
  document.getElementById('cmdRemoveAll').disabled = decdn_Prefs.mHostView.rowCount === 0;

  const prefCDNs = document.getElementById('prefCDNsBlock');
  let sCDNs = prefCDNs.defaultValue;
  if (prefCDNs.hasUserValue)
   sCDNs = prefCDNs.valueFromPreferences;
  const cdnList = JSON.parse(sCDNs);

  let hostSpecial = false;
  for (const h in decdn_Prefs.mHostView.hostList)
  {
   if (decdn_Prefs.mHostView.hostList[h] === decdn_CONSTS.ACTION.OPTION.BYPASS)
    continue;
   hostSpecial = true;
   break;
  }

  const hasSpecial = hostSpecial || Object.keys(cdnList).length > 0;
  document.getElementById('chkBlockMissing').checked = hasSpecial;
  document.getElementById('tabCDNs').collapsed = !hasSpecial;
  document.getElementById('lblDowngradeDesc1').collapsed = hasSpecial;
  document.getElementById('lblDowngradeDesc2').collapsed = !hasSpecial;

  decdn_Prefs.mCDNView.populateHostList(cdnList);

  document.getElementById('trCDNs').view = decdn_Prefs.mCDNView;

  decdn_Prefs.mCDNView.updateCheckState();

  document.getElementById('cmdFontBypass').label = decdn_Prefs._locale.GetStringFromName('button.' + decdn_CONSTS.ACTION.OPTION.BYPASS);

  const prefFontDomains = document.getElementById('prefFontDomains');
  let sFontHosts = prefFontDomains.defaultValue;
  if (prefFontDomains.hasUserValue)
   sFontHosts = prefFontDomains.valueFromPreferences;
  try
  {
   decdn_Prefs.mFontView.fontList = JSON.parse(sFontHosts);
  }
  catch(ex)
  {
   decdn_Prefs.mFontView.fontList = [];
  }
  await decdn_Prefs.mFontView.genIconList();
  decdn_Prefs.mFontView.draw();
  document.getElementById('cmdFontRemoveAll').disabled = decdn_Prefs.mFontView.rowCount === 0;

  decdn_Prefs._updateHash();
  document.getElementById('prefCommit').addEventListener('change', decdn_Prefs._updateHash);

  let sBranch = document.getElementById('prefBranch').defaultValue;
  if (document.getElementById('prefBranch').hasUserValue)
   sBranch = document.getElementById('prefBranch').valueFromPreferences;
  decdn_Prefs._branch = sBranch;
  decdn_Prefs.updateBranches();
  decdn_Prefs._updateBlocking();
 },
 _updateHash: function()
 {
  if (document.getElementById('prefCommit').hasUserValue)
   decdn_Prefs._commit = document.getElementById('prefCommit').valueFromPreferences;
  else
   decdn_Prefs._commit = '';

  const lnkArchive = document.getElementById('lnkArchive');
  if (!!decdn_Prefs._commit && decdn_Prefs._commit.length === 40)
  {
   let tLinkBase = document.getElementById('prefLinkBase').defaultValue;
   if (document.getElementById('prefLinkBase').hasUserValue)
    tLinkBase = document.getElementById('prefLinkBase').valueFromPreferences;
   let tLinkGraph = document.getElementById('prefLinkGraph').defaultValue;
   if (document.getElementById('prefLinkGraph').hasUserValue)
    tLinkGraph = document.getElementById('prefLinkGraph').valueFromPreferences;
   tLinkGraph = tLinkGraph.replaceAll('%COMMIT%', decdn_Prefs._commit);
   lnkArchive.setAttribute('class', 'text-link');
   lnkArchive.setAttribute('value', decdn_Prefs._commit.slice(0, 10));
   lnkArchive.setAttribute('href', tLinkBase + tLinkGraph);
   lnkArchive.setAttribute('tooltiptext', tLinkBase + tLinkGraph);
  }
  else
  {
   lnkArchive.removeAttribute('class');
   lnkArchive.setAttribute('value', 'N/A');
   lnkArchive.removeAttribute('href');
   lnkArchive.removeAttribute('tooltiptext');
  }
 },
 _updateBlocking: function()
 {
  const b = document.getElementById('chkBlockMissing').checked;
  document.getElementById('tabCDNs').collapsed = !b;
  document.getElementById('lblSiteScope').collapsed = !b;
  document.getElementById('cmbSiteScope').collapsed = !b;
  document.getElementById('cmdSiteScope').collapsed = !b;
  document.getElementById('colSiteScopeHdr').collapsed = !b;
  document.getElementById('colSiteScope').collapsed = !b;
  document.getElementById('cmbNewSiteScope').collapsed = !b;
  if (b)
   document.getElementById('cmdBypass').label = decdn_Prefs._locale.GetStringFromName('button.' + document.getElementById('cmbNewSiteScope').value);
  else
   document.getElementById('cmdBypass').label = decdn_Prefs._locale.GetStringFromName('button.' + decdn_CONSTS.ACTION.OPTION.BYPASS);
  document.getElementById('lblHostScope').collapsed = !b;
  document.getElementById('lblDowngradeDesc1').collapsed = b;
  document.getElementById('lblDowngradeDesc2').collapsed = !b;
  window.sizeToContent();
 },
 _updateFonts: function()
 {
  const b = document.getElementById('chkGoogleFonts').checked;
  document.getElementById('tabFonts').collapsed = !b;
 },
 _getBrowser: function()
 {
  const mediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  const brw = mediator.getMostRecentWindow('navigator:browser');
  if (!brw)
   return false;
  if (!brw.decdn_Archive)
   return false;
  return brw;
 },
 updateBranches: function()
 {
  document.getElementById('cmdRefreshBranches').disabled = true;

  let sURL = document.getElementById('prefBranchAPI').defaultValue;
  if (document.getElementById('prefBranchAPI').hasUserValue)
   sURL = document.getElementById('prefBranchAPI').valueFromPreferences;

  let lAge = document.getElementById('prefBranchAge').defaultValue;
  if (document.getElementById('prefBranchAge').hasUserValue)
   lAge = document.getElementById('prefBranchAge').valueFromPreferences;

  const cmbBranch = document.getElementById('cmbBranch');
  let sWasBranch = cmbBranch.value;
  if (!sWasBranch)
   sWasBranch = decdn_Prefs._branch;
  const pBranch = cmbBranch.getAttribute('preference');
  cmbBranch.removeAttribute('preference');
  cmbBranch.removeAllItems();
  cmbBranch.disabled = true;
  const sLoading = decdn_Prefs._locale.GetStringFromName('branch.loading');
  cmbBranch.appendItem(sLoading);
  cmbBranch.selectedIndex = 0;

  const XMLHttpRequest = Components.Constructor('@mozilla.org/xmlextras/xmlhttprequest;1', 'nsIXMLHttpRequest');
  const xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function()
  {
   if(xmlhttp.readyState !== 4)
    return;
   document.getElementById('cmdRefreshBranches').disabled = false;
   if(xmlhttp.status < 200 || xmlhttp.status > 299)
   {
    decdn_Prefs._defBranch();
    return;
   }
   if(xmlhttp.response === null || xmlhttp.response.byteLength === 0)
   {
    decdn_Prefs._defBranch();
    return;
   }
   const respJSON = xmlhttp.response;
   if (respJSON.length < 1)
   {
    decdn_Prefs._defBranch();
    return;
   }
   cmbBranch.removeAllItems();
   let bFound = false;
   for (let i = 0; i < respJSON.length; i++)
   {
    if (!respJSON[i].hasOwnProperty('name'))
     continue;
    if (!respJSON[i].hasOwnProperty('commit'))
     continue;
    let sDate = false;
    if (respJSON[i].commit.hasOwnProperty('timestamp'))
     sDate = respJSON[i].commit.timestamp;
    else if (respJSON[i].commit.hasOwnProperty('committed_date'))
     sDate = respJSON[i].commit.committed_date;
    if (!sDate)
     continue;
    const sName = respJSON[i].name;
    const dTime = new Date(sDate);
    if (isNaN(dTime.valueOf()))
     continue;
    if (lAge > 0)
    {
     if (Date.now() - dTime.getTime() > lAge * 30 * 24 * 60 * 60 * 1000)
      continue;
    }
    const sTime = dTime.toLocaleDateString();
    if (sName === sWasBranch)
     bFound = sName;
    cmbBranch.appendItem(sName, sName, ' - ' + decdn_Prefs._locale.formatStringFromName('branch.updated', [sTime], 1));
   }
   if (cmbBranch.itemCount === 0)
   {
    decdn_Prefs._defBranch();
    return;
   }
   if (!bFound)
   {
    cmbBranch.appendItem(sWasBranch, sWasBranch, ' - ???');
    cmbBranch.value = sWasBranch;
    cmbBranch.disabled = false;
    cmbBranch.setAttribute('preference', pBranch);
    return;
   }
   cmbBranch.value = bFound;
   cmbBranch.disabled = false;
   cmbBranch.setAttribute('preference', pBranch);
  };
  xmlhttp.onerror = function()
  {
   decdn_Prefs._defBranch();
  };
  xmlhttp.ontimeout = function()
  {
   decdn_Prefs._defBranch();
  };
  xmlhttp.mozBackgroundRequest = true;
  xmlhttp.open('GET', sURL);
  xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_ANONYMOUS | Components.interfaces.nsIRequest.LOAD_BACKGROUND | Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE | Components.interfaces.nsIRequest.INHIBIT_PERSISTENT_CACHING;
  xmlhttp.timeout = 10000;
  xmlhttp.responseType = 'json';
  xmlhttp.setRequestHeader('Accept', 'application/json;q=0.9,*/*;q=0.8');
  xmlhttp.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
  xmlhttp.send();
 },
 _defBranch: function()
 {
  const cmbBranch = document.getElementById('cmbBranch');
  cmbBranch.removeAllItems();
  cmbBranch.appendItem(decdn_Prefs._branch, decdn_Prefs._branch);
  cmbBranch.value = decdn_Prefs._branch;
  cmbBranch.disabled = true;
  document.getElementById('cmdRefreshBranches').disabled = false;
 },
 onBranchChange: function(ev)
 {
  const newBranch = ev.target.value;
  if (decdn_Prefs._branch === newBranch)
   document.getElementById('lblBranchChanged').setAttribute('style', 'visibility: hidden;');
  else
   document.getElementById('lblBranchChanged').removeAttribute('style');
 },
 onBlockChange: function()
 {
  if (document.getElementById('chkBlockMissing').checked)
  {
   let allUnset = true;
   for (let i = 0; i < decdn_Prefs.mCDNView.rowCount; i++)
   {
    if (decdn_Prefs.mCDNView.getValueOfRow(i) === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
     continue;
    allUnset = false;
    break;
   }
   if (allUnset)
   {
    for (let i = 0; i < decdn_Prefs.mCDNView.rowCount; i++)
    {
     decdn_Prefs.mCDNView.setValueOfRow(i, decdn_CONSTS.ACTION.OPTION.BLOCKMISSING);
    }
    decdn_Prefs.mCDNView.updateCheckState();
   }
  }
  else
  {
   let mBy = 0;
   let mBl = 0;
   for (const h in decdn_Prefs.mHostView.hostList)
   {
    if (decdn_Prefs.mHostView.hostList[h] === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
     mBy++;
    if (decdn_Prefs.mHostView.hostList[h] === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
     mBl++;
   }
   if ((mBy + mBl) > 0)
   {
    const dlg = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
    const chk = {};
    let sList = '';
    if (mBy > 1 && mBl > 1)
     sList = decdn_Prefs._locale.formatStringFromName('confirm.bypass.plural+block.plural', [mBy, mBl], 2);
    else if (mBy > 1 && mBl === 1)
     sList = decdn_Prefs._locale.formatStringFromName('confirm.bypass.plural+block.single', [mBy], 1);
    else if (mBy === 1 && mBl > 1)
     sList = decdn_Prefs._locale.formatStringFromName('confirm.bypass.single+block.plural', [mBl], 1);
    else if (mBy === 1 && mBl === 1)
     sList = decdn_Prefs._locale.GetStringFromName('confirm.bypass.single+block.single');
    else if (mBy > 1 && mBl < 1)
     sList = decdn_Prefs._locale.formatStringFromName('confirm.bypass.plural', [mBy], 1);
    else if (mBy === 1 && mBl < 1)
     sList = decdn_Prefs._locale.GetStringFromName('confirm.bypass.single');
    else if (mBy < 1 && mBl > 1)
     sList = decdn_Prefs._locale.formatStringFromName('confirm.block.plural', [mBy], 1);
    else if (mBy < 1 && mBl === 1)
     sList = decdn_Prefs._locale.GetStringFromName('confirm.block.single');
    if (sList.length > 0)
    {
     const sMsg = decdn_Prefs._locale.formatStringFromName('confirm.message', [sList], 1);
     const r = dlg.confirmEx(window, decdn_Prefs._locale.GetStringFromName('confirm.title'), sMsg, dlg.STD_YES_NO_BUTTONS, null, null, null, null, chk);
     if (r !== 0)
     {
      document.getElementById('chkBlockMissing').checked = true;
      return;
     }
    }
    for (const h in decdn_Prefs.mHostView.hostList)
    {
     if (decdn_Prefs.mHostView.hostList[h] === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
      delete decdn_Prefs.mHostView.hostList[h];
     if (decdn_Prefs.mHostView.hostList[h] === decdn_CONSTS.ACTION.OPTION.BLOCKMISSING)
      delete decdn_Prefs.mHostView.hostList[h];
    }
    decdn_Prefs.mHostView.draw();
   }
  }
  decdn_Prefs.updatePrefs();
  decdn_Prefs._updateBlocking();
 },
 onFontsChange: function()
 {
  decdn_Prefs.updatePrefs();
  decdn_Prefs._updateFonts();
 },
 updatePrefs: function()
 {
  const prefBypass = document.getElementById('prefSitesBypass');
  if (!document.getElementById('chkBlockMissing').checked)
  {
   const bareList = {};
   for (const host in decdn_Prefs.mHostView.hostList)
   {
    bareList[host] = decdn_CONSTS.ACTION.OPTION.BYPASS;
   }
   prefBypass.value = JSON.stringify(bareList);
  }
  else
   prefBypass.value = JSON.stringify(decdn_Prefs.mHostView.hostList);

  const cdnList = {};
  if (document.getElementById('chkBlockMissing').checked)
  {
   for (const idx in decdn_Prefs.mCDNView.cdnList)
   {
    if (decdn_Prefs.mCDNView.cdnList[idx].value === decdn_CONSTS.ACTION.OPTION.BYPASSMISSING)
     continue;
    cdnList[decdn_Prefs.mCDNView.cdnList[idx].host] = decdn_Prefs.mCDNView.cdnList[idx].value;
   }
  }
  const prefCDNs = document.getElementById('prefCDNsBlock');
  prefCDNs.value = JSON.stringify(cdnList);

  const prefFonts = document.getElementById('prefFontDomains');
  prefFonts.value = JSON.stringify(decdn_Prefs.mFontView.fontList);
 },
 onBeforeAccept: function()
 {
  const newBranch = document.getElementById('prefBranch').value;
  if (decdn_Prefs._branch === newBranch)
   return;
  const brw = decdn_Prefs._getBrowser();
  if (!brw)
   return;
  brw.decdn_Archive.erase();
  brw.decdn_Archive.load(newBranch);
 },
 onClose: function()
 {
  const prefInstant = document.getElementById('prefInstant').value;
  if (!prefInstant)
   return;
  const newBranch = document.getElementById('prefBranch').value;
  if (decdn_Prefs._branch === newBranch)
   return;
  const brw = decdn_Prefs._getBrowser();
  if (!brw)
   return;
  brw.decdn_Archive.erase();
  brw.decdn_Archive.load(newBranch);
 },
 resetArchive: function()
 {
  const dlg = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
  const chk = {};
  const r = dlg.confirmEx(window, decdn_Prefs._locale.GetStringFromName('reset.title'), decdn_Prefs._locale.GetStringFromName('reset.message'), dlg.STD_YES_NO_BUTTONS, null, null, null, null, chk);
  if (r !== 0)
   return;
  decdn_Prefs._branch = false;
  document.getElementById('lblBranchChanged').removeAttribute('style');
  decdn_Prefs._commit = false;
  const lnkArchive = document.getElementById('lnkArchive');
  lnkArchive.removeAttribute('class');
  lnkArchive.setAttribute('value', 'N/A');
  lnkArchive.removeAttribute('href');
  lnkArchive.removeAttribute('tooltiptext');
 }
};
