import type { 
  EditorDocument, 
  EditorNode, 
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

    // Handle Enter key
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        // Shift+Enter: Insert line break
        this.insertLineBreak();
        event.preventDefault();
      } else {
        // Enter: Create new paragraph
        this.handleEnterKey(event);
      }
    }

    // Handle Backspace
    if (event.key === 'Backspace') {
      this.handleBackspaceKey(event);
    }

    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
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

    // If we're in a heading, create a new paragraph
    if (currentElement && this.isHeading(currentElement)) {
      event.preventDefault();
      this.insertParagraphAfter(currentElement);
    }
    // Otherwise, let the browser handle it naturally
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
          // TODO: Implement redo
        } else {
          event.preventDefault();
          // TODO: Implement undo
        }
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
      default:
        return false;
    }

    // Copy content and replace element
    newElement.innerHTML = currentElement.innerHTML;
    currentElement.parentNode?.replaceChild(newElement, currentElement);

    // Restore selection
    this.restoreSelectionInElement(newElement);
    
    this.triggerChange();
    return true;
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
    if (this.options.onChange) {
      const content = this.getContent();
      this.options.onChange(content);
    }
  }

  private updateCurrentSelection() {
    const selection = window.getSelection();
    if (!selection) {
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
    const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'BLOCKQUOTE', 'PRE'];
    return blockTags.includes(element.tagName);
  }

  private isHeading(element: HTMLElement): boolean {
    return /^H[1-6]$/.test(element.tagName);
  }

  private isFormatActive(format: FormatType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    // Simple check using queryCommandState
    switch (format) {
      case 'bold':
        return document.queryCommandState('bold');
      case 'italic':
        return document.queryCommandState('italic');
      case 'underline':
        return document.queryCommandState('underline');
      case 'strikethrough':
        return document.queryCommandState('strikeThrough');
      default:
        return false;
    }
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
    // Get all nodes within the range
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

    const elementsToRemove: HTMLElement[] = [];
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const element = node as HTMLElement;
      if (range.intersectsNode(element)) {
        elementsToRemove.push(element);
      }
    }

    // Remove formatting by unwrapping elements
    elementsToRemove.forEach(element => {
      this.unwrapElement(element);
    });
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
      case 'code':
        type = 'codeblock';
        break;
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
} 