import type { SyntaxNode } from '../utils.js';
import type { LanguageTypeConfig, ParameterExtractor } from './types.js';
import { typeConfig as cCppConfig } from './c-cpp.js';
import { extractSimpleTypeName, extractVarName } from './shared.js';

/**
 * ObjC method parameter: -(void)doThing:(NSString *)name withFoo:(int)foo
 * method_parameter has fields `type` (type_specifier) and `declarator` (_declarator).
 * The declarator may be a pointer_declarator wrapping an identifier.
 */
const extractParameter: ParameterExtractor = (node: SyntaxNode, env: Map<string, string>): void => {
  if (node.type === 'method_parameter') {
    const typeNode = node.childForFieldName('type');
    const declarator = node.childForFieldName('declarator');
    if (!typeNode || !declarator) return;
    const nameNode = declarator.type === 'pointer_declarator'
      ? declarator.firstNamedChild
      : declarator;
    if (!nameNode) return;
    const varName = extractVarName(nameNode);
    const typeName = extractSimpleTypeName(typeNode);
    if (varName && typeName) env.set(varName, typeName);
  } else {
    // Delegate C-style parameter_declaration to cCppConfig
    cCppConfig.extractParameter(node, env);
  }
};

export const typeConfig: LanguageTypeConfig = {
  ...cCppConfig,
  extractParameter,
};
