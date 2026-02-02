import { renderDraftJSText } from '../../routes/courses/utils';
import type {
  Module,
  TitleModule,
  TextBlockModule,
  LexicalModule,
  TableModule,
  ResourceModule,
  LinkModule,
  ColumnLayoutModule,
  FormulaModule,
  PollModule,
  PreviewLexicalModule,
  ResourceLink,
} from '../../routes/courses/types';

// Type checking functions
export function isModule<T extends Module>(
  module: Module,
  contentCheck: (content: any) => boolean,
): module is T {
  return 'content' in module && contentCheck(module.content);
}

export function isTitleModule(module: Module): module is TitleModule {
  return isModule(module, (content) => content && typeof content.value === 'string');
}

export function isTextBlockModule(module: Module): module is TextBlockModule {
  return isModule(module, (content) => content && content.content && content.content.blocks);
}

export function isLexicalModule(module: Module): module is LexicalModule {
  return isModule(
    module,
    (content) => content && content.editor === 'lexical' && typeof content.html === 'string',
  );
}

export function isTableModule(module: Module): module is TableModule {
  return (
    module.type === '0d49d130-c197-421d-a56a-d1ba0a67cfc0' &&
    isModule(
      module,
      (content) =>
        content && typeof content.content === 'string' && content.content.includes('<table'),
    )
  );
}

export function isLegacyEditorModule(module: Module): boolean {
  return (
    module.type === '0d49d130-c197-421d-a56a-d1ba0a67cfc0' &&
    isModule(
      module,
      (content) =>
        content && typeof content.content === 'string' && !content.content.includes('<table'),
    )
  );
}

export function isResourceModule(module: Module): module is ResourceModule {
  return isModule(module, (content) => content && content.value && content.value.resources);
}

export function isLinkModule(module: Module): module is LinkModule {
  return isModule(module, (content) => content && content.url);
}

export function isPreviewLexicalModule(module: Module): module is PreviewLexicalModule {
  if (module.type === 'f388e4f9-b350-4ee8-964b-2618ea4a037a') {
    return (
      'content' in module && module.content && typeof (module.content as any).html === 'string'
    );
  }
  return (
    'content' in module &&
    module.content &&
    typeof (module.content as any).html === 'string' &&
    (module.content as any).displayMode
  );
}

export function isColumnLayoutModule(module: Module): module is ColumnLayoutModule {
  return (
    module.type === 'c082b45f-abf5-41fa-9c15-74233ab52c91' &&
    isModule(module, (content) => content && content.AdvanceLayout)
  );
}

export function isFormulaModule(module: Module): module is FormulaModule {
  return (
    module.type === 'e3f1b225-d159-4a7f-bc84-2fddf05ed6d6' &&
    isModule(module, (content) => content && content.formula && content.scale)
  );
}

export function isPollModule(module: Module): module is PollModule {
  return (
    module.type === 'b30fef7f-528f-4c0c-bfb4-0cc78e77767a' &&
    isModule(module, (content) => content && content.proposition && Array.isArray(content.options))
  );
}

// Rendered module type
export type RenderedModule =
  | { type: 'title'; content: string }
  | { type: 'text'; content: string }
  | { type: 'table'; content: string }
  | { type: 'resources'; content: ResourceLink[] }
  | { type: 'link'; content: string }
  | {
      type: 'columnLayout';
      content: { col1: string[]; col2: string[]; col3: string[]; layoutStyle: string };
    }
  | { type: 'formula'; content: { formula: string; scale: string } }
  | { type: 'poll'; content: { uuid: string; proposition: string; options: string[] } };

// Render module to RenderedModule
export function renderModule(module: Module, allModules?: Module[]): RenderedModule | null {
  if (isTitleModule(module)) {
    return { type: 'title', content: module.content.value };
  } else if (isPreviewLexicalModule(module)) {
    // Preview Lexical modules have HTML content with displayMode
    return {
      type: 'text',
      content: module.content.html,
    };
  } else if (isLexicalModule(module)) {
    // Lexical editor modules have HTML content
    return {
      type: 'text',
      content: module.content.html,
    };
  } else if (isColumnLayoutModule(module)) {
    return {
      type: 'columnLayout',
      content: module.content.AdvanceLayout,
    };
  } else if (isLegacyEditorModule(module)) {
    // Legacy editor modules have HTML content but use the table module UUID
    return {
      type: 'text',
      content: (module.content as any).content,
    };
  } else if (isTableModule(module)) {
    // Table modules have HTML table content
    return {
      type: 'table',
      content: module.content.content,
    };
  } else if (isTextBlockModule(module)) {
    return {
      type: 'text',
      content: renderDraftJSText(module.content.content),
    };
  } else if (isResourceModule(module)) {
    return {
      type: 'resources',
      content: module.content.value.resources.filter((r) => r.selected),
    };
  } else if (isLinkModule(module)) {
    return { type: 'link', content: module.content.url };
  } else if (isColumnLayoutModule(module)) {
    return {
      type: 'columnLayout',
      content: module.content.AdvanceLayout,
    };
  } else if (isFormulaModule(module)) {
    return {
      type: 'formula',
      content: {
        formula: module.content.formula,
        scale: module.content.scale,
      },
    };
  } else if (isPollModule(module)) {
    return {
      type: 'poll',
      content: {
        uuid: module.content.uuid,
        proposition: module.content.proposition,
        options: module.content.options,
      },
    };
  }
  return null;
}

// Sort modules by their linked list structure
export function sortModules(
  modules: Module[],
  options?: { filterByParentModule?: boolean },
): Module[] {
  if (!modules || modules.length === 0) return [];

  let contentModules = modules;

  // Filter out the container module if requested
  if (options?.filterByParentModule) {
    contentModules = modules.filter((m) => m.parentModule !== null);
    if (contentModules.length === 0) return modules;
  }

  const moduleMap = new Map<string, Module>();
  contentModules.forEach((module) => {
    moduleMap.set(module.uuid, module);
  });

  const firstModule = contentModules.find(
    (module) => !module.prevModule || !moduleMap.has(module.prevModule),
  );

  if (!firstModule) {
    return contentModules;
  }

  const orderedModules: Module[] = [];
  let currentModule: Module | undefined = firstModule;

  while (currentModule && orderedModules.length < modules.length) {
    orderedModules.push(currentModule);
    currentModule = currentModule.nextModule ? moduleMap.get(currentModule.nextModule) : undefined;
  }

  // Add any remaining modules that weren't in the linked list
  contentModules.forEach((module) => {
    if (!orderedModules.includes(module)) {
      orderedModules.push(module);
    }
  });

  return orderedModules;
}
