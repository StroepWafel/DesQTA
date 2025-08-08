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
import { SeqtaMentionsService, type SeqtaMentionItem } from '../../../services/seqtaMentionsService';

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
    if (event.key === 'Backspace' || event.key === 'Delete') {
      this.handleBackspaceKey(event);
      // Also check for mention search after deletion
      if (!isInCodeBlock) {
        setTimeout(() => {
          this.checkForMentionSearch();
        }, 0);
      }
    }

    // Handle @ key for mentions
    if (event.key === '@' && !isInCodeBlock) {
      // Let the character be inserted first, then handle mention
      setTimeout(() => {
        this.handleMentionTrigger();
      }, 0);
    }
    
    // Handle typing after @ for real-time search
    if (!isInCodeBlock && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Check if we're typing after an @ symbol
      setTimeout(() => {
        this.checkForMentionSearch();
      }, 0);
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
    // Clean up mention dropdown when editor loses focus
    setTimeout(() => {
      this.removeMentionDropdown();
    }, 200); // Small delay to allow for mention selection
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
    // First convert visual mentions back to text format for saving
    const contentClone = this.element.cloneNode(true) as HTMLElement;
    this.convertVisualMentionsToText(contentClone);
    
    const nodes = this.parseHTMLToNodes(contentClone);
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
    this.reinitializeMentions();
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
      case 'insert-image':
        return this.insertImage();
      case 'insert-link':
        return this.insertLink();
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

  public insertImage(): boolean {
    // Create a file input to select image
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleImageFile(file);
      }
      // Clean up
      document.body.removeChild(input);
    };
    
    // Trigger file selection
    document.body.appendChild(input);
    input.click();
    
    return true;
  }

  private handleImageFile(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Selected file is not an image');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('Image file is too large (max 5MB)');
      return;
    }

    // Create FileReader to convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        this.insertImageElement(dataUrl, file.name);
      }
    };
    reader.onerror = () => {
      console.error('Error reading image file');
    };
    reader.readAsDataURL(file);
  }

  private insertImageElement(src: string, alt: string = '') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return;

    // Create image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'editor-image-container';
    imageContainer.style.margin = '1rem 0';
    imageContainer.style.textAlign = 'center';
    
    // Create image element
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '0.5rem';
    img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    img.style.cursor = 'pointer';
    
    // Add click handler for image actions (future: edit, delete, etc.)
    img.onclick = () => {
      this.handleImageClick(imageContainer, img);
    };

    imageContainer.appendChild(img);

    // Insert after current element
    currentElement.parentNode?.insertBefore(imageContainer, currentElement.nextSibling);

    // Create a new paragraph after the image
    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    imageContainer.parentNode?.insertBefore(paragraph, imageContainer.nextSibling);

    // Focus the new paragraph
    this.restoreSelectionInElement(paragraph);

    this.triggerChange();
  }

  private handleImageClick(container: HTMLElement, img: HTMLImageElement) {
    // Simple implementation: show image actions
    // In a production app, you might show a context menu or modal
    const actions = ['Copy Alt Text', 'Remove Image', 'Replace Image'];
    const action = prompt(`Image Actions:\n1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}\n\nEnter number (1-3):`);
    
    switch (action) {
      case '1':
        navigator.clipboard.writeText(img.alt || 'Image');
        break;
      case '2':
        if (confirm('Remove this image?')) {
          container.parentNode?.removeChild(container);
          this.triggerChange();
        }
        break;
      case '3':
        // Trigger new image selection
        this.insertImage();
        // Remove old image after new one is selected
        setTimeout(() => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
            this.triggerChange();
          }
                 }, 100);
         break;
     }
   }

   public insertLink(): boolean {
     const selection = window.getSelection();
     if (!selection || selection.rangeCount === 0) return false;

     const range = selection.getRangeAt(0);
     const selectedText = range.toString().trim();
     
     // Check if we're already in a link
     const existingLink = this.findParentLink(range.startContainer);
     
     if (existingLink) {
       // Edit existing link
       this.editLink(existingLink);
     } else {
       // Create new link
       this.createLink(selectedText, range);
     }
     
     return true;
   }

   private findParentLink(node: Node): HTMLAnchorElement | null {
     let current = node;
     
     while (current && current !== this.element) {
       if (current.nodeType === Node.ELEMENT_NODE) {
         const element = current as HTMLElement;
         if (element.tagName === 'A') {
           return element as HTMLAnchorElement;
         }
       }
       const parentNode = current.parentNode;
       if (!parentNode) break;
       current = parentNode;
     }
     
     return null;
   }

   private createLink(selectedText: string, range: Range) {
     // Prompt for URL
     const url = prompt('Enter the URL:', selectedText.startsWith('http') ? selectedText : 'https://');
     if (!url) return;

     // Prompt for link text if no text is selected
     let linkText = selectedText;
     if (!linkText) {
       linkText = prompt('Enter the link text:', url) || url;
     }

     // Validate URL
     if (!this.isValidUrl(url)) {
       alert('Please enter a valid URL');
       return;
     }

     // Create link element
     const link = document.createElement('a');
     link.href = url;
     link.textContent = linkText;
     link.style.color = 'var(--accent-color, #3b82f6)';
     link.style.textDecoration = 'underline';
     link.style.cursor = 'pointer';
     link.target = '_blank';
     link.rel = 'noopener noreferrer';
     
     // Add click handler for link editing
     link.onclick = (e) => {
       e.preventDefault();
       this.editLink(link);
     };

     if (range.collapsed) {
       // No selection, insert link at cursor
       range.insertNode(link);
       range.setStartAfter(link);
       range.setEndAfter(link);
     } else {
       // Replace selection with link
       range.deleteContents();
       range.insertNode(link);
       range.setStartAfter(link);
       range.setEndAfter(link);
     }

     // Update selection
     const newSelection = window.getSelection();
     if (newSelection) {
       newSelection.removeAllRanges();
       newSelection.addRange(range);
     }

     this.triggerChange();
   }

   private editLink(link: HTMLAnchorElement) {
     const currentUrl = link.href;
     const currentText = link.textContent || '';
     
     const newUrl = prompt('Edit URL:', currentUrl);
     if (newUrl === null) return; // User cancelled
     
     const newText = prompt('Edit link text:', currentText);
     if (newText === null) return; // User cancelled

     if (newUrl && this.isValidUrl(newUrl)) {
       link.href = newUrl;
       link.textContent = newText || newUrl;
       this.triggerChange();
     } else if (newUrl) {
       alert('Please enter a valid URL');
     }
   }

   private isValidUrl(url: string): boolean {
     try {
       new URL(url);
       return true;
     } catch {
       // Try with https:// prefix
       try {
         new URL('https://' + url);
         return true;
       } catch {
         return false;
       }
     }
   }

   private handleMentionTrigger() {
     const selection = window.getSelection();
     if (!selection || selection.rangeCount === 0) return;

     const range = selection.getRangeAt(0);
     const textNode = range.startContainer;
     
     if (textNode.nodeType !== Node.TEXT_NODE) return;
     
     const text = textNode.textContent || '';
     const cursorPos = range.startOffset;
     
     // Find the @ symbol before cursor
     const beforeCursor = text.substring(0, cursorPos);
     const atIndex = beforeCursor.lastIndexOf('@');
     
     if (atIndex === -1) return;
     
     // Get the query after @
     const query = beforeCursor.substring(atIndex + 1);
     
     // Only trigger if @ is at word boundary or start
     if (atIndex > 0 && /\w/.test(beforeCursor[atIndex - 1])) return;
     
     this.showMentionAutocomplete(textNode, atIndex, query);
   }

   private checkForMentionSearch() {
     const selection = window.getSelection();
     if (!selection || selection.rangeCount === 0) return;

     const range = selection.getRangeAt(0);
     const textNode = range.startContainer;
     
     if (textNode.nodeType !== Node.TEXT_NODE) return;
     
     const text = textNode.textContent || '';
     const cursorPos = range.startOffset;
     
     // Find the @ symbol before cursor
     const beforeCursor = text.substring(0, cursorPos);
     const atIndex = beforeCursor.lastIndexOf('@');
     
     // Check if we're currently in a mention context
     if (atIndex === -1) {
       // No @ found, close any open dropdown
       this.removeMentionDropdown();
       return;
     }
     
     // Get the query after @
     const query = beforeCursor.substring(atIndex + 1);
     
     // Check if @ is at word boundary or start
     if (atIndex > 0 && /\w/.test(beforeCursor[atIndex - 1])) {
       this.removeMentionDropdown();
       return;
     }
     
     // Check if query contains spaces or newlines (end of mention)
     if (query.includes(' ') || query.includes('\n')) {
       this.removeMentionDropdown();
       return;
     }
     
     // Check if cursor is too far from @ (more than 50 characters)
     if (query.length > 50) {
       this.removeMentionDropdown();
       return;
     }
     
     // Debounce the search to avoid too many API calls
     if (this.mentionSearchTimeout) {
       clearTimeout(this.mentionSearchTimeout);
     }
     
     this.mentionSearchTimeout = window.setTimeout(() => {
       // If we already have a dropdown open, update it with new query
       if (this.currentMentionDropdown) {
         this.updateMentionDropdown(textNode, atIndex, query);
       } else {
         // Show new dropdown if query is reasonable
         this.showMentionAutocomplete(textNode, atIndex, query);
       }
     }, 200); // 200ms debounce
   }

   private async updateMentionDropdown(textNode: Node, atIndex: number, query: string) {
     if (!this.currentMentionDropdown) return;
     
     // Clear current dropdown content
     this.currentMentionDropdown.innerHTML = '';
     
     // Remove existing event listeners to prevent memory leaks
     if (this.currentMentionKeyHandler) {
       document.removeEventListener('keydown', this.currentMentionKeyHandler);
       this.currentMentionKeyHandler = null;
     }
     
     // Get new suggestions
     const suggestions = await this.getMentionSuggestions(query);
     
     // Debug logging
     console.log('Updated mention suggestions for query "' + query + '":', suggestions);
     
     if (suggestions.length === 0) {
       // Show "no results" message
       const noResults = document.createElement('div');
       noResults.className = 'p-3 text-center text-slate-500 dark:text-slate-400';
       noResults.textContent = query ? `No results for "${query}"` : 'No SEQTA elements found';
       this.currentMentionDropdown!.appendChild(noResults);
       return;
     }
     
     // Add new suggestions
     suggestions.forEach((suggestion, index) => {
       const item = document.createElement('div');
       item.className = 'mention-item p-3 cursor-pointer border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';
       
       if (index === 0) {
         item.classList.add('selected', 'bg-slate-50', 'dark:bg-slate-700');
       }

       // Add icon based on type
       const icon = this.getMentionIcon(suggestion.type);
       item.innerHTML = `
         <span class="text-lg">${icon}</span>
         <div class="flex-1">
           <div class="font-medium text-slate-900 dark:text-slate-100">${suggestion.title}</div>
           <div class="text-sm text-slate-600 dark:text-slate-400">${suggestion.subtitle}</div>
         </div>
       `;

       item.addEventListener('click', () => {
         this.insertMention(textNode, atIndex, suggestion);
       });

       this.currentMentionDropdown!.appendChild(item);
     });

     // Update keyboard navigation
     this.setupMentionKeyboardHandling(this.currentMentionDropdown, textNode, atIndex);
   }

       private async showMentionAutocomplete(textNode: Node, atIndex: number, query: string) {
      // Create or update autocomplete dropdown
      await this.createMentionDropdown(textNode, atIndex, query);
    }

    private async createMentionDropdown(textNode: Node, atIndex: number, query: string) {
      // Remove existing dropdown
      this.removeMentionDropdown();

      const dropdown = document.createElement('div');
      dropdown.className = 'mention-autocomplete';
      // Use Tailwind-style classes for better theme integration
      dropdown.className = 'mention-autocomplete fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[250px]';
      dropdown.style.cssText = `
        position: absolute;
        z-index: 1000;
      `;

      // Get mention suggestions
      const suggestions = await this.getMentionSuggestions(query);
      
      // Debug logging
      console.log('Mention suggestions:', suggestions);
      
      if (suggestions.length === 0) {
        // Show "no results" message
        const noResults = document.createElement('div');
        noResults.className = 'p-3 text-center text-slate-500 dark:text-slate-400';
        noResults.textContent = 'No SEQTA elements found';
        dropdown.appendChild(noResults);
      }
      
      suggestions.forEach((suggestion, index) => {
               const item = document.createElement('div');
        item.className = 'mention-item p-3 cursor-pointer border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';
        
        if (index === 0) {
          item.classList.add('selected', 'bg-slate-50', 'dark:bg-slate-700');
        }

               // Add icon based on type
        const icon = this.getMentionIcon(suggestion.type);
        item.innerHTML = `
          <span class="text-lg">${icon}</span>
          <div class="flex-1">
            <div class="font-medium text-slate-900 dark:text-slate-100">${suggestion.title}</div>
            <div class="text-sm text-slate-600 dark:text-slate-400">${suggestion.subtitle}</div>
          </div>
        `;

       item.addEventListener('click', () => {
         this.insertMention(textNode, atIndex, suggestion);
       });

       dropdown.appendChild(item);
     });

     // Position dropdown
     this.positionMentionDropdown(dropdown, textNode, atIndex);
     
     // Store reference for cleanup
     this.currentMentionDropdown = dropdown;
     
     // Add to DOM
     document.body.appendChild(dropdown);

     // Handle keyboard navigation
     this.setupMentionKeyboardHandling(dropdown, textNode, atIndex);
   }

       private async getMentionSuggestions(query: string): Promise<SeqtaMentionItem[]> {
      try {
        return await SeqtaMentionsService.searchMentions(query);
      } catch (error) {
        console.error('Error fetching mention suggestions:', error);
        // Fallback to mock data
        return this.getMockMentionSuggestions(query);
      }
    }

    private getMockMentionSuggestions(query: string): SeqtaMentionItem[] {
      const mockSuggestions: SeqtaMentionItem[] = [
        {
          id: 'assignment-1',
          type: 'assignment',
          title: 'Mathematics Assignment 3',
          subtitle: 'Mathematics • Due: Tomorrow, 11:59 PM',
          data: { subject: 'Mathematics', dueDate: '2024-01-15T23:59:00Z' }
        },
        {
          id: 'class-1',
          type: 'class',
          title: 'Year 10 Mathematics',
          subtitle: 'Mr. Smith • Room 204',
          data: { year: 10, subject: 'Mathematics', nextClass: '2024-01-14T14:00:00Z' }
        },
        {
          id: 'subject-1',
          type: 'subject',
          title: 'English Literature',
          subtitle: 'ENG10 • Ms. Johnson • 4 assignments',
          data: { code: 'ENG10', assignments: 4 }
        },
        {
          id: 'assessment-1',
          type: 'assessment',
          title: 'Chemistry Test',
          subtitle: 'Chemistry • Next Friday • Test',
          data: { subject: 'Chemistry', date: '2024-01-19T09:00:00Z' }
        },
        {
          id: 'timetable-1',
          type: 'timetable',
          title: 'Schedule for Today',
          subtitle: '6 classes scheduled',
          data: { date: '2024-01-14', classCount: 6 }
        }
      ];

      // Filter by query
      if (!query) return mockSuggestions.slice(0, 5);
      
      return mockSuggestions.filter(s => 
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
    }

   private getMentionIcon(type: string): string {
     const icons = {
       assignment: '📝',
       class: '🎓',
       subject: '📚',
       assessment: '📊',
       timetable: '📅',
       default: '🔗'
     };
     return icons[type as keyof typeof icons] || icons.default;
   }

   private positionMentionDropdown(dropdown: HTMLElement, textNode: Node, atIndex: number) {
     // Create a temporary range to get cursor position
     const range = document.createRange();
     range.setStart(textNode, atIndex);
     range.setEnd(textNode, atIndex + 1);
     
     const rect = range.getBoundingClientRect();
     const editorRect = this.element.getBoundingClientRect();
     
     // Position below cursor
     dropdown.style.left = `${rect.left}px`;
     dropdown.style.top = `${rect.bottom + 5}px`;
     
     // Adjust if dropdown would go off-screen
     const dropdownRect = dropdown.getBoundingClientRect();
     if (dropdownRect.right > window.innerWidth) {
       dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10}px`;
     }
     if (dropdownRect.bottom > window.innerHeight) {
       dropdown.style.top = `${rect.top - dropdownRect.height - 5}px`;
     }
   }

   private setupMentionKeyboardHandling(dropdown: HTMLElement, textNode: Node, atIndex: number) {
     const items = dropdown.querySelectorAll('.mention-item');
     let selectedIndex = 0;

     const keyHandler = (e: KeyboardEvent) => {
       switch (e.key) {
         case 'ArrowDown':
           e.preventDefault();
           selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
           this.updateMentionSelection(items, selectedIndex);
           break;
         case 'ArrowUp':
           e.preventDefault();
           selectedIndex = Math.max(selectedIndex - 1, 0);
           this.updateMentionSelection(items, selectedIndex);
           break;
         case 'Enter':
         case 'Tab':
           e.preventDefault();
           const selectedItem = items[selectedIndex] as HTMLElement;
           if (selectedItem) selectedItem.click();
           break;
         case 'Escape':
           e.preventDefault();
           this.removeMentionDropdown();
           break;
       }
     };

     document.addEventListener('keydown', keyHandler);
     
     // Store handler for cleanup
     this.currentMentionKeyHandler = keyHandler;
   }

       private updateMentionSelection(items: NodeListOf<Element>, selectedIndex: number) {
      items.forEach((item, index) => {
        const htmlItem = item as HTMLElement;
        if (index === selectedIndex) {
          htmlItem.classList.add('selected', 'bg-slate-50', 'dark:bg-slate-700');
        } else {
          htmlItem.classList.remove('selected', 'bg-slate-50', 'dark:bg-slate-700');
        }
      });
    }

   private insertMention(textNode: Node, atIndex: number, suggestion: any) {
     // Remove the @ and query text
     const text = textNode.textContent || '';
     const afterAt = text.substring(atIndex);
     const spaceIndex = afterAt.indexOf(' ');
     const endIndex = spaceIndex === -1 ? text.length : atIndex + spaceIndex;
     
     // Create mention text with special format: @[type:id:title]
     // Encode any special characters in the title to avoid conflicts
     const encodedTitle = suggestion.title.replace(/[\[\]:]/g, (match: string) => {
       const replacements: { [key: string]: string } = { '[': '&#91;', ']': '&#93;', ':': '&#58;' };
       return replacements[match] || match;
     });
     const mentionText = `@[${suggestion.type}:${suggestion.id}:${encodedTitle}]`;
     
     // Store the full suggestion data in a global mention registry
     this.storeMentionData(suggestion.id, suggestion);
     
     // Replace the @ and query with the mention text
     const range = document.createRange();
     range.setStart(textNode, atIndex);
     range.setEnd(textNode, endIndex);
     range.deleteContents();
     
     const mentionTextNode = document.createTextNode(mentionText + ' ');
     range.insertNode(mentionTextNode);
     
     // Position cursor after the mention
     range.setStartAfter(mentionTextNode);
     range.collapse(true);
     
     // Update selection
     const selection = window.getSelection();
     if (selection) {
       selection.removeAllRanges();
       selection.addRange(range);
     }

     this.removeMentionDropdown();
     
     // Convert the text mention to visual mention immediately
     setTimeout(() => {
       this.convertTextMentionsToVisual();
     }, 0);
     
     this.triggerChange();
   }

   private handleMentionClick(mention: HTMLElement, suggestion: any) {
     // Show mention details or update data
     const actions = ['View Details', 'Update Data', 'Remove Mention'];
     const action = prompt(`${suggestion.title}\n\n1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}\n\nEnter number (1-3):`);
     
     switch (action) {
       case '1':
         this.showMentionDetails(suggestion);
         break;
       case '2':
         this.updateMentionData(mention, suggestion);
         break;
       case '3':
         if (confirm('Remove this mention?')) {
           mention.parentNode?.removeChild(mention);
           this.triggerChange();
         }
         break;
     }
   }

   private async handlePersistedMentionClick(mention: HTMLElement, mentionId: string, mentionType: string, mentionData: string) {
     try {
       // Parse the stored mention data
       const data = JSON.parse(mentionData);
       
       // Create a suggestion-like object for compatibility
       const suggestion = {
         id: mentionId,
         type: mentionType,
         title: mention.textContent?.replace(/^[📝📊🎓📚📅📢]\s*/, '') || 'Unknown',
         subtitle: this.formatMentionSubtitle(mentionType, data),
         data: data,
         lastUpdated: new Date().toISOString()
       };
       
       // Show mention details or update data
       const actions = ['View Details', 'Update Data', 'Remove Mention'];
       const action = prompt(`${suggestion.title}\n\n1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}\n\nEnter number (1-3):`);
       
       switch (action) {
         case '1':
           this.showMentionDetails(suggestion);
           break;
         case '2':
           // Update the mention with fresh data
           await this.refreshMentionData(mention, mentionId, mentionType);
           break;
         case '3':
           if (confirm('Remove this mention?')) {
             mention.parentNode?.removeChild(mention);
             this.triggerChange();
           }
           break;
       }
     } catch (error) {
       console.error('Error handling persisted mention click:', error);
       alert('Error loading mention data');
     }
   }

   private formatMentionSubtitle(mentionType: string, data: any): string {
     switch (mentionType) {
       case 'assignment':
         return `${data.subject || 'Unknown Subject'} • Due: ${data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'Unknown'}`;
       case 'assessment':
         return `${data.subject || 'Unknown Subject'} • ${data.type || 'Assessment'}`;
       case 'class':
         return `${data.subject || 'Unknown Subject'} • ${data.teacher || 'Unknown Teacher'}`;
       case 'subject':
         return `${data.code || 'Unknown Code'} • ${data.teacher || 'Unknown Teacher'}`;
       case 'timetable':
         return `${data.subject || 'Unknown Subject'} • ${data.time || 'Unknown Time'}`;
       default:
         return 'SEQTA Element';
     }
   }

   private async refreshMentionData(mention: HTMLElement, mentionId: string, mentionType: string) {
     try {
       // Get fresh data from SEQTA
       const updatedData = await SeqtaMentionsService.updateMentionData(mentionId, mentionType);
       
       if (updatedData) {
         // Update the mention's data attributes
         mention.dataset.mentionData = JSON.stringify(updatedData.data);
         
         // Update the display text if needed
         const icon = this.getMentionIcon(mentionType);
         mention.innerHTML = `${icon} ${updatedData.title}`;
         
         // Update subtitle in tooltip or data attribute
         mention.title = this.formatMentionSubtitle(mentionType, updatedData.data);
         
         this.triggerChange();
         alert('Mention data updated successfully!');
       } else {
         alert('Could not refresh mention data');
       }
     } catch (error) {
       console.error('Error refreshing mention data:', error);
       alert('Error refreshing mention data');
     }
   }

   private showMentionDetails(suggestion: any) {
     alert(`${suggestion.title}\n\nType: ${suggestion.type}\nDetails: ${suggestion.subtitle}\n\nData: ${JSON.stringify(suggestion.data, null, 2)}`);
   }

       private async updateMentionData(mention: HTMLElement, suggestion: any) {
      try {
        mention.style.opacity = '0.7';
        
        const updatedData = await SeqtaMentionsService.updateMentionData(
          suggestion.id || mention.dataset.mentionId,
          suggestion.type || mention.dataset.mentionType
        );
        
        if (updatedData) {
          // Update the mention display
          mention.innerHTML = `${this.getMentionIcon(updatedData.type)} ${updatedData.title}`;
          mention.dataset.mentionData = JSON.stringify(updatedData.data);
          mention.title = `Updated: ${new Date().toLocaleTimeString()}`;
          this.triggerChange();
        }
        
        mention.style.opacity = '1';
      } catch (error) {
        console.error('Failed to update mention data:', error);
        mention.style.opacity = '1';
        mention.title = 'Update failed';
      }
    }

   private removeMentionDropdown() {
     if (this.currentMentionDropdown) {
       document.body.removeChild(this.currentMentionDropdown);
       this.currentMentionDropdown = null;
     }
     
     if (this.currentMentionKeyHandler) {
       document.removeEventListener('keydown', this.currentMentionKeyHandler);
       this.currentMentionKeyHandler = null;
     }
     
     if (this.mentionSearchTimeout) {
       clearTimeout(this.mentionSearchTimeout);
       this.mentionSearchTimeout = null;
     }
   }

   private storeMentionData(id: string, suggestion: SeqtaMentionItem) {
     this.mentionRegistry.set(id, suggestion);
   }

   private convertTextMentionsToVisual() {
     const walker = document.createTreeWalker(
       this.element,
       NodeFilter.SHOW_TEXT,
       null
     );

     const textNodes: Text[] = [];
     let node: Node | null;
     while (node = walker.nextNode()) {
       textNodes.push(node as Text);
     }

     // Process text nodes for mention patterns
     textNodes.forEach(textNode => {
       const text = textNode.textContent || '';
       const mentionRegex = /@\[([^:]+):([^:]+):([^\]]+)\]/g;
       let match;
       const replacements: { start: number, end: number, element: HTMLElement }[] = [];

       while ((match = mentionRegex.exec(text)) !== null) {
         const [fullMatch, type, id, encodedTitle] = match;
         const title = encodedTitle.replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&#58;/g, ':');
         
         // Get suggestion data from registry or create minimal data
         const suggestion = this.mentionRegistry.get(id) || {
           id,
           type: type as any,
           title,
           subtitle: `${type} mention`,
           data: {},
           lastUpdated: new Date().toISOString()
         };

         // Create visual mention element
         const mention = this.createVisualMention(suggestion);
         
         replacements.push({
           start: match.index!,
           end: match.index! + fullMatch.length,
           element: mention
         });
       }

       // Apply replacements in reverse order to maintain indices
       replacements.reverse().forEach(replacement => {
         const range = document.createRange();
         range.setStart(textNode, replacement.start);
         range.setEnd(textNode, replacement.end);
         range.deleteContents();
         range.insertNode(replacement.element);
       });
     });
   }

   private createVisualMention(suggestion: SeqtaMentionItem): HTMLElement {
     const mention = document.createElement('span');
     mention.className = 'seqta-mention';
     mention.contentEditable = 'false';
     mention.dataset.mentionId = suggestion.id;
     mention.dataset.mentionType = suggestion.type;
     mention.dataset.mentionData = JSON.stringify(suggestion.data);
     
     mention.style.cssText = `
       display: inline-block;
       background: var(--accent-color, #3b82f6);
       color: white;
       padding: 0.125rem 0.5rem;
       border-radius: 0.375rem;
       font-size: 0.875rem;
       font-weight: 500;
       margin: 0 0.125rem;
       cursor: pointer;
       transition: all 0.2s;
     `;
     
     mention.innerHTML = `${this.getMentionIcon(suggestion.type)} ${suggestion.title}`;
     
     // Add click handler
     mention.addEventListener('click', (e) => {
       e.preventDefault();
       e.stopPropagation();
       this.handlePersistedMentionClick(mention, suggestion.id, suggestion.type, JSON.stringify(suggestion.data));
     });
     
     // Add hover effects
     mention.addEventListener('mouseenter', () => {
       mention.style.opacity = '0.8';
       mention.style.transform = 'scale(1.02)';
     });
     
     mention.addEventListener('mouseleave', () => {
       mention.style.opacity = '1';
       mention.style.transform = 'scale(1)';
     });
     
     return mention;
   }

   private convertVisualMentionsToText(element: HTMLElement) {
     const mentions = element.querySelectorAll('span.seqta-mention');
     
     mentions.forEach(mention => {
       const mentionId = mention.getAttribute('data-mention-id') || '';
       const mentionType = mention.getAttribute('data-mention-type') || '';
       const title = mention.textContent?.replace(/^[📝📊🎓📚📅📢]\s*/, '') || 'Unknown';
       
       // Encode special characters in title
       const encodedTitle = title.replace(/[\[\]:]/g, (match: string) => {
         const replacements: { [key: string]: string } = { '[': '&#91;', ']': '&#93;', ':': '&#58;' };
         return replacements[match] || match;
       });
       
       // Create text mention format
       const mentionText = `@[${mentionType}:${mentionId}:${encodedTitle}]`;
       const textNode = document.createTextNode(mentionText);
       
       // Replace the visual mention with text
       mention.parentNode?.replaceChild(textNode, mention);
     });
   }

   private reinitializeMentions() {
     // Convert any text-based mentions to visual mentions
     this.convertTextMentionsToVisual();
   }

   // Add properties to track mention state
   private currentMentionDropdown: HTMLElement | null = null;
   private currentMentionKeyHandler: ((e: KeyboardEvent) => void) | null = null;
   private mentionSearchTimeout: number | null = null;
   private mentionRegistry: Map<string, SeqtaMentionItem> = new Map();

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
      case 'img':
        type = 'image';
        break;
      case 'a':
        type = 'link';
        break;
      case 'span':
        // Check if it's a SEQTA mention
        if (element.classList.contains('seqta-mention')) {
          type = 'seqta-mention';
        } else {
          type = 'text';
        }
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
    
    // Handle images specially
    if (tagName === 'img') {
      return {
        type: 'image' as EditorNodeType,
        attributes: {
          src: element.getAttribute('src') || '',
          alt: element.getAttribute('alt') || ''
        },
        text: '',
        children: []
      };
    }
    
    // Handle links specially
    if (tagName === 'a') {
      return {
        type: 'link' as EditorNodeType,
        attributes: {
          href: element.getAttribute('href') || '',
          target: element.getAttribute('target') || '_blank',
          rel: element.getAttribute('rel') || 'noopener noreferrer'
        },
        text: element.textContent || '',
        children: []
      };
    }
    
    // Handle SEQTA mentions specially
    if (tagName === 'span' && element.classList.contains('seqta-mention')) {
      return {
        type: 'seqta-mention' as EditorNodeType,
        attributes: {
          mentionId: element.dataset.mentionId || '',
          mentionType: element.dataset.mentionType || '',
          mentionData: element.dataset.mentionData || '{}'
        },
        text: element.textContent || '',
        children: []
      };
    }
    
    return {
      type: type as EditorNodeType,
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
        case 'image':
          const src = node.attributes?.src || '';
          const alt = node.attributes?.alt || '';
          return `<div class="editor-image-container" style="margin: 1rem 0; text-align: center;"><img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); cursor: pointer;" /></div>`;
        case 'link':
          const href = node.attributes?.href || '';
          const target = node.attributes?.target || '_blank';
          const rel = node.attributes?.rel || 'noopener noreferrer';
          return `<a href="${href}" target="${target}" rel="${rel}" style="color: var(--accent-color, #3b82f6); text-decoration: underline; cursor: pointer;">${node.text || href}</a>`;
        case 'seqta-mention':
          const mentionId = node.attributes?.mentionId || '';
          const mentionType = node.attributes?.mentionType || '';
          const mentionData = node.attributes?.mentionData || '{}';
          const icon = this.getMentionIcon(mentionType);
          return `<span class="seqta-mention" data-mention-id="${mentionId}" data-mention-type="${mentionType}" data-mention-data="${mentionData}" style="display: inline-block; background: var(--accent-color, #3b82f6); color: white; padding: 0.125rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; margin: 0 0.125rem; cursor: pointer;" contenteditable="false">${icon} ${node.text}</span>`;
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