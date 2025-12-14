// MLIR PEG.js Grammar v2.0 - Fixed for PEG.js 0.7.0
// Parses MLIR operations in the format:
// %out = "dialect.OpName"(%in1, %in2) {attr-dict}: (type1, type2) -> type_out loc(#loc)
// Changes: SSA values can start with numbers, removed text() calls

{
  function buildOperation(output, opName, inputs, attrs, types, loc) {
    return {
      output: output,
      opName: opName,
      inputs: inputs || [],
      attributes: attrs || {},
      inputTypes: types ? types.inputs : [],
      outputType: types ? types.output : null,
      location: loc
    };
  }
}

Start
  = _ ops:Operation* _ { return ops; }

Operation
  = output:SSAValue _ "=" _ opName:OpName _ inputs:InputList? _ attrs:AttrDict? _ types:TypeSignature? _ loc:Location? _ {
      return buildOperation(output, opName, inputs, attrs, types, loc);
    }

SSAValue
  = "%" name:SSAIdentifier { return "%" + name; }

SSAIdentifier
  = chars:[a-zA-Z0-9_]+ { return chars.join(''); }

OpName
  = '"' name:QualifiedName '"' { return name; }

QualifiedName
  = first:Identifier rest:("." Identifier)* {
      return first + rest.map(r => r[0] + r[1]).join('');
    }

InputList
  = "(" _ inputs:SSAValueList? _ ")" { return inputs || []; }

SSAValueList
  = first:SSAValue rest:(_ "," _ SSAValue)* {
      return [first].concat(rest.map(r => r[3]));
    }

AttrDict
  = "{" _ attrs:AttrList? _ "}" { 
      const result = {};
      if (attrs) {
        attrs.forEach(attr => {
          result[attr.key] = attr.value;
        });
      }
      return result;
    }

AttrList
  = first:Attribute rest:(_ "," _ Attribute)* {
      return [first].concat(rest.map(r => r[3]));
    }

Attribute
  = key:Identifier _ "=" _ value:AttrValue {
      return { key: key, value: value };
    }

AttrValue
  = TypedValue
  / StringLiteral
  / Identifier

TypedValue
  = value:[^,}]+ { return value.join(''); }

StringLiteral
  = '"' chars:[^"]* '"' { return '"' + chars.join('') + '"'; }

NumberLiteral
  = digits:[0-9]+ decimal:("." [0-9]+)? {
      return digits.join('') + (decimal ? decimal[0] + decimal[1].join('') : '');
    }

TypeSignature
  = ":" _ "(" _ inputs:TypeList? _ ")" _ "->" _ output:Type {
      return { inputs: inputs || [], output: output };
    }

TypeList
  = first:Type rest:(_ "," _ Type)* {
      return [first].concat(rest.map(r => r[3]));
    }

Type
  = ComplexType / SimpleType

ComplexType
  = base:[a-zA-Z0-9_]+ "<" nested:TypeContent ">" {
      return base.join('') + '<' + nested + '>';
    }

TypeContent
  = chars:(ComplexType / [^<>] / "<" TypeContent ">")+ {
      return chars.map(c => typeof c === 'string' ? c : c).join('');
    }

SimpleType
  = chars:[^,)\n\r\t <]+ { return chars.join(''); }

Location
  = "loc(" loc:[^)]+ ")" { return loc.join(''); }

Identifier
  = first:[a-zA-Z_] rest:[a-zA-Z0-9_]* { return first + rest.join(''); }

_ "whitespace"
  = [ \t\n\r]*