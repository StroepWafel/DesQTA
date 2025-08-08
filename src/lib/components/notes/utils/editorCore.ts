import type { 
  EditorDocument, 
  EditorNode, 
  EditorNodeType,
  EditorOptions, 
  EditorSelection,
  EditorRange,
  FormatType,
  BlockType 
} from '../types/editor';

export class EditorCore {
  private element: HTMLElement;
  private options: EditorOptions;
  private isInitialized = false;
  private currentSelection: EditorSelection | null = null;
  private history: string[] = [];
  private historyIndex = -1;
  private maxHistorySize = 100;

  constructor(element: HTMLElement, options: EditorOptions = {}) {
    this.element = element;
    this.options = {
      placeholder: 'Start writing...',
      readonly: false,
      ...options
    };

    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;

    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize with empty content if no content exists
    if (this.element.innerHTML.trim() === '') {
      this.element.innerHTML = '<p><br></p>';
    }

    // Save initial state to history
    this.saveToHistory();

    this.isInitialized = true;
  }

  private setupEventListeners() {
    // Input events
    this.element.addEventListener('input', this.handleInput.bind(this));
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.element.addEventListener('keyup', this.handleKeyUp.bind(this));
    this.element.addEventListener('paste', this.handlePaste.bind(this));

    // Focus events
    this.element.addEventListener('focus', this.handleFocus.bind(this));
    this.element.addEventListener('blur', this.handleBlur.bind(this));

    // Selection events
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
  }

  private handleInput(event: Event) {
    // Prevent default behavior for readonly mode
    if (this.options.readonly) {
      event.preventDefault();
      return;
    }

    // Ensure we always have at least one paragraph
    if (this.element.innerHTML.trim() === '' || this.element.innerHTML === '<br>') {
      this.element.innerHTML = '<p><br></p>';
      this.setCursorToStart();
    }

    // Trigger change event
    this.triggerChange();
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.options.readonly) {
      event.preventDefault();
      return;
    }

    // Check if we're in a code block
    const selection = window.getSelection();
    const isInCodeBlock = selection && selection.rangeCount > 0 && 
      this.getCurrentBlockType() === 'code-block';

    // Handle Enter key
    if (event.key === 'Enter') {
      if (event.shiftKey || isInCodeBlock) {
        // Shift+Enter or code block: Insert line break
        this.insertLineBreak();
        event.preventDefault();
      } else {
        // Enter: Create new paragraph
        this.handleEnterKey(event);
      }
    }

    // Handle Tab key in code blocks
    if (event.key === 'Tab' && isInCodeBlock) {
      event.preventDefault();
      this.insertText('  '); // Insert 2 spaces for indentation
      return;
    }

    // Handle Tab key in tables
    if (event.key === 'Tab' && this.isInTable()) {
      event.preventDefault();
      this.navigateTable(event.shiftKey ? 'previous' : 'next');
      return;
    }

    // Handle Backspace
    if (event.key === 'Backspace') {
      this.handleBackspaceKey(event);
    }

    // Handle keyboard shortcuts (disabled in code blocks for some)
    if (event.ctrlKey || event.metaKey) {
      // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z in code blocks
      if (isInCodeBlock && !['a', 'c', 'v', 'z'].includes(event.key.toLowerCase())) {
        return; // Don't handle other shortcuts in code blocks
      }
      this.handleShortcut(event);
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    // Update selection after key operations
    this.updateCurrentSelection();
  }

  private handlePaste(event: ClipboardEvent) {
    if (this.options.readonly) {
      event.preventDefault();
      return;
    }

    // Get plain text from clipboard
    const text = event.clipboardData?.getData('text/plain');
    if (text) {
      // Prevent default paste behavior
      event.preventDefault();
      
      // Insert plain text
      this.insertText(text);
    }
  }

  private handleFocus() {
    if (this.options.onFocus) {
      this.options.onFocus();
    }
  }

  private handleBlur() {
    if (this.options.onBlur) {
      this.options.onBlur();
    }
  }

  private handleSelectionChange() {
    // Only handle if this editor is focused
    if (document.activeElement === this.element) {
      this.updateCurrentSelection();
      
      if (this.options.onSelectionChange && this.currentSelection) {
        this.options.onSelectionChange(this.currentSelection);
      }
    }
  }

  private handleEnterKey(event: KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);

    if (!currentElement) return;

    // Check if we're in a list item
    if (currentElement.tagName === 'LI') {
      event.preventDefault();
      this.handleListEnter(currentElement, range);
      return;
    }

    // If we're in a heading, create a new paragraph
    if (this.isHeading(currentElement)) {
      event.preventDefault();
      this.insertParagraphAfter(currentElement);
    }
    // Otherwise, let the browser handle it naturally
  }

  private handleListEnter(listItem: HTMLElement, range: Range) {
    // If the list item is empty, exit the list
    if (!listItem.textContent?.trim()) {
      const list = listItem.parentElement;
      if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
        // Remove empty list item
        list.removeChild(listItem);
        
        // Create a new paragraph after the list
        const paragraph = document.createElement('p');
        paragraph.innerHTML = '<br>';
        list.parentNode?.insertBefore(paragraph, list.nextSibling);
        
        // Move cursor to new paragraph
        this.restoreSelectionInElement(paragraph);
      }
    } else {
      // Create a new list item
      const newListItem = document.createElement('li');
      newListItem.innerHTML = '<br>';
      
      // Insert after current list item
      listItem.parentNode?.insertBefore(newListItem, listItem.nextSibling);
      
      // Move cursor to new list item
      this.restoreSelectionInElement(newListItem);
    }
  }

  private handleBackspaceKey(event: KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // If we're at the start of a block element and it's empty, convert to paragraph
    if (range.collapsed && range.startOffset === 0) {
      const currentElement = this.getBlockElement(range.startContainer);
      if (currentElement && this.isHeading(currentElement) && currentElement.textContent?.trim() === '') {
        event.preventDefault();
        this.convertToParagraph(currentElement);
      }
    }
  }

  private handleShortcut(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    
    switch (key) {
      case 'b':
        event.preventDefault();
        this.toggleFormat('bold');
        break;
      case 'i':
        event.preventDefault();
        this.toggleFormat('italic');
        break;
      case 'u':
        event.preventDefault();
        this.toggleFormat('underline');
        break;
      case 'z':
        if (event.shiftKey) {
          event.preventDefault();
          this.redo();
        } else {
          event.preventDefault();
          this.undo();
        }
        break;
      case 'a':
        event.preventDefault();
        this.selectAll();
        break;
    }
  }

  // Public methods
  public focus() {
    this.element.focus();
  }

  public blur() {
    this.element.blur();
  }

  public getContent(): EditorDocument {
    const nodes = this.parseHTMLToNodes(this.element);
    const metadata = this.calculateMetadata(nodes);
    
    return {
      version: '1.0',
      nodes,
      metadata
    };
  }

  public setContent(content: EditorDocument) {
    const html = this.renderNodesToHTML(content.nodes);
    this.element.innerHTML = html;
    this.triggerChange();
  }

  public insertText(text: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Delete existing selection if any
    if (!range.collapsed) {
      range.deleteContents();
    }
    
    // Handle multi-line text insertion
    const lines = text.split('\n');
    
    if (lines.length === 1) {
      // Single line - simple text insertion
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
    } else {
      // Multi-line - create paragraphs for each line
      const currentBlock = this.getBlockElement(range.startContainer);
      
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) {
          // First line goes in current position
          if (lines[i]) {
            const textNode = document.createTextNode(lines[i]);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          }
        } else {
          // Subsequent lines create new paragraphs
          const newParagraph = document.createElement('p');
          newParagraph.textContent = lines[i] || '';
          if (!lines[i]) {
            newParagraph.innerHTML = '<br>';
          }
          
          // Insert after current block
          const insertPoint = currentBlock?.parentNode;
          if (insertPoint) {
            insertPoint.insertBefore(newParagraph, currentBlock.nextSibling);
            
            // Move cursor to end of new paragraph
            const newRange = document.createRange();
            newRange.setStart(newParagraph, newParagraph.childNodes.length);
            newRange.setEnd(newParagraph, newParagraph.childNodes.length);
            range.setStart(newRange.startContainer, newRange.startOffset);
            range.setEnd(newRange.endContainer, newRange.endOffset);
          }
        }
      }
    }
    
    // Update selection
    selection.removeAllRanges();
    selection.addRange(range);
    
    this.triggerChange();
  }

  public executeCommand(command: string, value?: any): boolean {
    switch (command) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
      case 'code':
        return this.toggleFormat(command as FormatType);
      case 'heading-1':
      case 'heading-2':
      case 'heading-3':
      case 'heading-4':
      case 'heading-5':
      case 'heading-6':
        return this.setBlockType(command as BlockType);
      case 'paragraph':
        return this.setBlockType('paragraph');
      case 'blockquote':
        return this.setBlockType('blockquote');
      case 'code-block':
        return this.setBlockType('code-block');
      case 'bullet-list':
        return this.toggleList('ul');
      case 'numbered-list':
        return this.toggleList('ol');
      case 'insert-table':
        return this.insertTable(2, 2); // Default 2x2 table
      default:
        return false;
    }
  }

  public toggleFormat(format: FormatType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
      // No selection, toggle format for future typing
      // This is a simplified implementation
      return false;
    }

    // Apply or remove formatting
    const isActive = this.isFormatActive(format);
    
    if (isActive) {
      this.removeFormat(format, range);
    } else {
      this.applyFormat(format, range);
    }

    this.triggerChange();
    return true;
  }

  public setBlockType(blockType: BlockType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return false;

    let newElement: HTMLElement;

    switch (blockType) {
      case 'paragraph':
        newElement = document.createElement('p');
        break;
      case 'heading-1':
        newElement = document.createElement('h1');
        break;
      case 'heading-2':
        newElement = document.createElement('h2');
        break;
      case 'heading-3':
        newElement = document.createElement('h3');
        break;
      case 'heading-4':
        newElement = document.createElement('h4');
        break;
      case 'heading-5':
        newElement = document.createElement('h5');
        break;
      case 'heading-6':
        newElement = document.createElement('h6');
        break;
      case 'blockquote':
        newElement = document.createElement('blockquote');
        break;
      case 'code-block':
        newElement = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.innerHTML = currentElement.innerHTML;
        newElement.appendChild(codeElement);
        break;
      default:
        return false;
    }

    // Copy content and replace element
    if (blockType === 'code-block') {
      // Code blocks already have their content set above
      currentElement.parentNode?.replaceChild(newElement, currentElement);
      // Restore selection in the code element
      const codeElement = newElement.querySelector('code');
      if (codeElement) {
        this.restoreSelectionInElement(codeElement);
      }
    } else {
      newElement.innerHTML = currentElement.innerHTML;
      currentElement.parentNode?.replaceChild(newElement, currentElement);
      // Restore selection
      this.restoreSelectionInElement(newElement);
    }
    
    this.triggerChange();
    return true;
  }

  public toggleList(listType: 'ul' | 'ol'): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return false;

    // Check if we're already in a list
    const existingList = this.findParentList(currentElement);
    
    if (existingList) {
      // If we're in a list, convert back to paragraphs
      this.convertListToParagraphs(existingList);
    } else {
      // Convert current paragraph(s) to list
      this.convertToList(currentElement, listType);
    }
    
    this.triggerChange();
    return true;
  }

  private findParentList(element: HTMLElement): HTMLElement | null {
    let current = element;
    
    while (current && current !== this.element) {
      if (current.tagName === 'UL' || current.tagName === 'OL') {
        return current;
      }
      if (current.tagName === 'LI' && current.parentElement) {
        const parent = current.parentElement;
        if (parent.tagName === 'UL' || parent.tagName === 'OL') {
          return parent;
        }
      }
      const parentElement = current.parentElement;
      if (!parentElement) break;
      current = parentElement;
    }
    
    return null;
  }

  private convertListToParagraphs(listElement: HTMLElement) {
    const listItems = Array.from(listElement.querySelectorAll('li'));
    
    listItems.forEach(li => {
      const paragraph = document.createElement('p');
      paragraph.innerHTML = li.innerHTML || '<br>';
      listElement.parentNode?.insertBefore(paragraph, listElement);
    });
    
    // Remove the list
    listElement.parentNode?.removeChild(listElement);
  }

  private convertToList(element: HTMLElement, listType: 'ul' | 'ol') {
    const list = document.createElement(listType);
    const listItem = document.createElement('li');
    
    // Move content to list item
    listItem.innerHTML = element.innerHTML || '<br>';
    list.appendChild(listItem);
    
    // Replace element with list
    element.parentNode?.replaceChild(list, element);
    
    // Restore selection in list item
    this.restoreSelectionInElement(listItem);
  }

  public insertTable(rows: number, cols: number): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return false;

    // Create table structure
    const table = document.createElement('table');
    table.className = 'editor-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = '1px solid #e2e8f0';
    table.style.marginTop = '1rem';
    table.style.marginBottom = '1rem';

    const tbody = document.createElement('tbody');
    
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('tr');
      
      for (let j = 0; j < cols; j++) {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        cell.style.border = '1px solid #e2e8f0';
        cell.style.padding = '0.5rem';
        cell.style.textAlign = 'left';
        cell.contentEditable = 'true';
        cell.innerHTML = i === 0 ? `Header ${j + 1}` : '<br>';
        
        row.appendChild(cell);
      }
      
      tbody.appendChild(row);
    }
    
    table.appendChild(tbody);

    // Insert table after current element
    currentElement.parentNode?.insertBefore(table, currentElement.nextSibling);

    // Create a new paragraph after the table
    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    table.parentNode?.insertBefore(paragraph, table.nextSibling);

    // Focus the first cell
    const firstCell = table.querySelector('th, td');
    if (firstCell) {
      this.restoreSelectionInElement(firstCell as HTMLElement);
    }

    this.triggerChange();
    return true;
  }

  private isInTable(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    while (node && node !== this.element) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'TD' || element.tagName === 'TH') {
          return true;
        }
      }
      const parentNode = node.parentNode;
      if (!parentNode) break;
      node = parentNode;
    }

    return false;
  }

  private navigateTable(direction: 'next' | 'previous') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let currentCell = range.startContainer;

    // Find the current table cell
    while (currentCell && currentCell !== this.element) {
      if (currentCell.nodeType === Node.ELEMENT_NODE) {
        const element = currentCell as HTMLElement;
        if (element.tagName === 'TD' || element.tagName === 'TH') {
          break;
        }
      }
      const parentNode = currentCell.parentNode;
      if (!parentNode) return;
      currentCell = parentNode;
    }

    if (!currentCell || currentCell === this.element) return;

    const cell = currentCell as HTMLElement;
    const table = cell.closest('table');
    if (!table) return;

    // Get all cells in the table
    const cells = Array.from(table.querySelectorAll('td, th'));
    const currentIndex = cells.indexOf(cell);

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex + 1;
      if (nextIndex >= cells.length) {
        // Add new row if we're at the end
        this.addTableRow(table);
        nextIndex = currentIndex + 1;
      }
    } else {
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = 0;
      }
    }

    const nextCell = cells[nextIndex] as HTMLElement;
    if (nextCell) {
      this.restoreSelectionInElement(nextCell);
    }
  }

  private addTableRow(table: HTMLElement) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const lastRow = tbody.querySelector('tr:last-child');
    if (!lastRow) return;

    const newRow = document.createElement('tr');
    const cellCount = lastRow.children.length;

    for (let i = 0; i < cellCount; i++) {
      const cell = document.createElement('td');
      cell.style.border = '1px solid #e2e8f0';
      cell.style.padding = '0.5rem';
      cell.style.textAlign = 'left';
      cell.contentEditable = 'true';
      cell.innerHTML = '<br>';
      newRow.appendChild(cell);
    }

    tbody.appendChild(newRow);
  }

  public getActiveFormats(): Set<string> {
    const activeFormats = new Set<string>();
    
    if (document.queryCommandState('bold')) activeFormats.add('bold');
    if (document.queryCommandState('italic')) activeFormats.add('italic');
    if (document.queryCommandState('underline')) activeFormats.add('underline');
    if (document.queryCommandState('strikeThrough')) activeFormats.add('strikethrough');
    
    // Check for code formatting manually since queryCommandState doesn't handle it
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      
      // Walk up the DOM tree to find code elements
      while (node && node !== this.element) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (element.tagName === 'CODE') {
            activeFormats.add('code');
            break;
          }
        }
        const parentNode = node.parentNode;
        if (!parentNode) break;
        node = parentNode;
      }
    }
    
    return activeFormats;
  }

  public getCurrentBlockType(): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 'paragraph';

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return 'paragraph';

    // Check if we're in a list first
    const parentList = this.findParentList(currentElement);
    if (parentList) {
      return parentList.tagName.toLowerCase() === 'ul' ? 'bullet-list' : 'numbered-list';
    }

    switch (currentElement.tagName.toLowerCase()) {
      case 'h1': return 'heading-1';
      case 'h2': return 'heading-2';
      case 'h3': return 'heading-3';
      case 'h4': return 'heading-4';
      case 'h5': return 'heading-5';
      case 'h6': return 'heading-6';
      case 'blockquote': return 'blockquote';
      case 'pre': return 'code-block';
      case 'code': 
        // Check if this code element is inside a pre (code block)
        const preParent = currentElement.closest('pre');
        if (preParent) return 'code-block';
        return 'paragraph';
      default: return 'paragraph';
    }
  }

  public destroy() {
    // Remove event listeners
    this.element.removeEventListener('input', this.handleInput.bind(this));
    this.element.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.element.removeEventListener('keyup', this.handleKeyUp.bind(this));
    this.element.removeEventListener('paste', this.handlePaste.bind(this));
    this.element.removeEventListener('focus', this.handleFocus.bind(this));
    this.element.removeEventListener('blur', this.handleBlur.bind(this));
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));

    this.isInitialized = false;
  }

  // Private helper methods
  private triggerChange() {
    // Save to history (debounced to avoid too many history entries)
    this.debouncedSaveToHistory();
    
    if (this.options.onChange) {
      const content = this.getContent();
      this.options.onChange(content);
    }
  }

  private debouncedSaveToHistory = this.debounce(() => {
    this.saveToHistory();
  }, 500);

  private debounce(func: Function, wait: number) {
    let timeout: number;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  private updateCurrentSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.currentSelection = null;
      return;
    }

    // Only update if the selection is within our editor
    const range = selection.getRangeAt(0);
    if (!this.element.contains(range.commonAncestorContainer)) {
      this.currentSelection = null;
      return;
    }

    this.currentSelection = {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
      isCollapsed: selection.isCollapsed,
      rangeCount: selection.rangeCount
    };
  }

  private getBlockElement(node: Node): HTMLElement | null {
    let current = node;
    
    while (current && current !== this.element) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as HTMLElement;
        if (this.isBlockElement(element)) {
          return element;
        }
      }
      current = current.parentNode!;
    }
    
    return null;
  }

  private isBlockElement(element: HTMLElement): boolean {
    const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'BLOCKQUOTE', 'PRE', 'LI'];
    return blockTags.includes(element.tagName);
  }

  private isHeading(element: HTMLElement): boolean {
    return /^H[1-6]$/.test(element.tagName);
  }

  private isFormatActive(format: FormatType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    // Check if the selection contains or is within a format element
    let node = range.startContainer;
    
    // If we have a selection, check all nodes within it
    if (!range.collapsed) {
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            const element = node as HTMLElement;
            if (this.isFormatElement(element, format) && range.intersectsNode(element)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      return walker.nextNode() !== null;
    }
    
    // For collapsed selection, check parent elements
    while (node && node !== this.element) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (this.isFormatElement(element, format)) {
          return true;
        }
      }
      const parentNode = node.parentNode;
      if (!parentNode) break;
      node = parentNode;
    }
    
    return false;
  }

  private applyFormat(format: FormatType, range: Range) {
    // Clone the range to avoid modifying the original
    const workingRange = range.cloneRange();
    
    // Extract the contents
    const contents = workingRange.extractContents();
    
    // Create the formatting element
    let element: HTMLElement;
    switch (format) {
      case 'bold':
        element = document.createElement('strong');
        break;
      case 'italic':
        element = document.createElement('em');
        break;
      case 'underline':
        element = document.createElement('u');
        break;
      case 'strikethrough':
        element = document.createElement('s');
        break;
      case 'code':
        element = document.createElement('code');
        break;
      default:
        return;
    }

    // Move the extracted contents into the formatting element
    element.appendChild(contents);
    
    // Insert the formatted element back into the range
    workingRange.insertNode(element);
    
    // Update the selection to encompass the new element
    const newRange = document.createRange();
    newRange.selectNodeContents(element);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private removeFormat(format: FormatType, range: Range) {
    // Save the original range
    const originalRange = range.cloneRange();
    
    if (range.collapsed) {
      // For collapsed selection, find and unwrap the closest format element
      let node = range.startContainer;
      while (node && node !== this.element) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (this.isFormatElement(element, format)) {
            this.unwrapElement(element);
            break;
          }
        }
        const parentNode = node.parentNode;
        if (!parentNode) break;
        node = parentNode;
      }
      return;
    }

    // For non-collapsed selection, find all format elements that intersect
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as HTMLElement;
          if (this.isFormatElement(element, format)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const elementsToProcess: HTMLElement[] = [];
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const element = node as HTMLElement;
      if (range.intersectsNode(element)) {
        elementsToProcess.push(element);
      }
    }

    // Process elements from innermost to outermost to avoid DOM disruption
    elementsToProcess.sort((a, b) => {
      if (a.contains(b)) return 1;
      if (b.contains(a)) return -1;
      return 0;
    });

    // Remove formatting by unwrapping elements
    elementsToProcess.forEach(element => {
      // Check if the element is fully within the selection
      const elementRange = document.createRange();
      elementRange.selectNodeContents(element);
      
      if (originalRange.compareBoundaryPoints(Range.START_TO_START, elementRange) <= 0 &&
          originalRange.compareBoundaryPoints(Range.END_TO_END, elementRange) >= 0) {
        // Fully selected - unwrap completely
        this.unwrapElement(element);
      } else {
        // Partially selected - need to split the element
        this.splitAndUnwrapElement(element, originalRange);
      }
    });
  }

  private splitAndUnwrapElement(element: HTMLElement, range: Range) {
    // This is a complex operation - for now, just unwrap the whole element
    // In a production app, you'd want to split the element at the range boundaries
    this.unwrapElement(element);
  }

  private isFormatElement(element: HTMLElement, format: FormatType): boolean {
    switch (format) {
      case 'bold':
        return element.tagName === 'STRONG' || element.tagName === 'B';
      case 'italic':
        return element.tagName === 'EM' || element.tagName === 'I';
      case 'underline':
        return element.tagName === 'U';
      case 'strikethrough':
        return element.tagName === 'S' || element.tagName === 'STRIKE';
      case 'code':
        return element.tagName === 'CODE';
      default:
        return false;
    }
  }

  private unwrapElement(element: HTMLElement) {
    const parent = element.parentNode;
    if (!parent) return;

    // Move all children to parent
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    
    // Remove the empty element
    parent.removeChild(element);
  }

  private insertLineBreak() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const br = document.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
    
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private insertParagraphAfter(element: HTMLElement) {
    const newParagraph = document.createElement('p');
    newParagraph.innerHTML = '<br>';
    
    element.parentNode?.insertBefore(newParagraph, element.nextSibling);
    
    // Move cursor to new paragraph
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(newParagraph, 0);
      range.setEnd(newParagraph, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private convertToParagraph(element: HTMLElement) {
    const newParagraph = document.createElement('p');
    newParagraph.innerHTML = '<br>';
    element.parentNode?.replaceChild(newParagraph, element);
    
    // Move cursor to new paragraph
    this.restoreSelectionInElement(newParagraph);
  }

  private setCursorToStart() {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(this.element, 0);
      range.setEnd(this.element, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private restoreSelectionInElement(element: HTMLElement) {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(element, 0);
      range.setEnd(element, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private parseHTMLToNodes(element: HTMLElement): EditorNode[] {
    // This is a simplified parser
    // In a full implementation, you'd recursively parse all child nodes
    const nodes: EditorNode[] = [];
    
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        nodes.push(this.parseElementToNode(element));
      } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        nodes.push({
          type: 'text',
          text: child.textContent
        });
      }
    }
    
    return nodes;
  }

  private parseElementToNode(element: HTMLElement): EditorNode {
    const tagName = element.tagName.toLowerCase();
    let type: any = 'paragraph';
    
    switch (tagName) {
      case 'p':
        type = 'paragraph';
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        type = 'heading';
        break;
      case 'blockquote':
        type = 'blockquote';
        break;
      case 'pre':
        // Check if this pre contains a code element
        if (element.querySelector('code')) {
          type = 'code-block';
        } else {
          type = 'paragraph';
        }
        break;
      case 'code':
        // Standalone code elements are inline, not blocks
        type = 'text';
        break;
      case 'ul':
        type = 'bullet-list';
        break;
      case 'ol':
        type = 'numbered-list';
        break;
      case 'li':
        type = 'list-item';
        break;
    }
    
    // Handle list items specially
    if (tagName === 'ul' || tagName === 'ol') {
      const listItems = Array.from(element.children).map(li => ({
        type: 'list-item' as EditorNodeType,
        text: li.textContent || '',
        children: []
      }));
      
      return {
        type: type as EditorNodeType,
        children: listItems,
        text: ''
      };
    }
    
    return {
      type,
      attributes: tagName === 'h1' ? { level: 1 } :
                 tagName === 'h2' ? { level: 2 } :
                 tagName === 'h3' ? { level: 3 } :
                 tagName === 'h4' ? { level: 4 } :
                 tagName === 'h5' ? { level: 5 } :
                 tagName === 'h6' ? { level: 6 } : {},
      text: element.textContent || '',
      children: []
    };
  }

  private renderNodesToHTML(nodes: EditorNode[]): string {
    // This is a simplified renderer
    return nodes.map(node => {
      switch (node.type) {
        case 'paragraph':
          return `<p>${node.text || '<br>'}</p>`;
        case 'heading':
          const level = node.attributes?.level || 1;
          return `<h${level}>${node.text || ''}</h${level}>`;
        case 'blockquote':
          return `<blockquote>${node.text || ''}</blockquote>`;
        case 'codeblock':
          return `<pre><code>${node.text || ''}</code></pre>`;
        case 'code-block':
          return `<pre><code>${node.text || ''}</code></pre>`;
        case 'bullet-list':
          const ulItems = node.children?.map(child => `<li>${child.text || ''}</li>`).join('') || '';
          return `<ul>${ulItems}</ul>`;
        case 'numbered-list':
          const olItems = node.children?.map(child => `<li>${child.text || ''}</li>`).join('') || '';
          return `<ol>${olItems}</ol>`;
        default:
          return `<p>${node.text || '<br>'}</p>`;
      }
    }).join('');
  }

  private calculateMetadata(nodes: EditorNode[]) {
    const text = nodes.map(node => node.text || '').join(' ');
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    
    return {
      word_count: words.length,
      character_count: text.length,
      seqta_references: [] // TODO: Extract SEQTA references
    };
  }

  // History management methods
  private saveToHistory() {
    const currentContent = this.element.innerHTML;
    
    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Add new state
    this.history.push(currentContent);
    this.historyIndex = this.history.length - 1;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.historyIndex = this.history.length - 1;
    }
  }

  public undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.element.innerHTML = this.history[this.historyIndex];
      this.triggerChange();
      return true;
    }
    return false;
  }

  public redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.element.innerHTML = this.history[this.historyIndex];
      this.triggerChange();
      return true;
    }
    return false;
  }

  // Selection management methods
  public saveSelection(): EditorSelection | null {
    this.updateCurrentSelection();
    return this.currentSelection;
  }

  public restoreSelection(selection: EditorSelection | null) {
    if (!selection) return false;

    const windowSelection = window.getSelection();
    if (!windowSelection) return false;

    try {
      windowSelection.removeAllRanges();
      
      const range = document.createRange();
      
      // Validate that the nodes are still in the document
      if (selection.anchorNode && 
          selection.focusNode && 
          this.element.contains(selection.anchorNode) &&
          this.element.contains(selection.focusNode)) {
        
        range.setStart(selection.anchorNode, selection.anchorOffset);
        range.setEnd(selection.focusNode, selection.focusOffset);
        
        windowSelection.addRange(range);
        return true;
      }
    } catch (error) {
      // Selection restoration failed, which can happen if DOM changed
      console.warn('Failed to restore selection:', error);
    }
    
    return false;
  }

  public selectAll() {
    const range = document.createRange();
    range.selectNodeContents(this.element);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  public collapseToEnd() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToEnd();
    }
  }

  public collapseToStart() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToStart();
    }
  }

  public getSelectedText(): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    
    return selection.toString();
  }

  public replaceSelection(text: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    
    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    
    selection.removeAllRanges();
    selection.addRange(range);
  }
} 