// MLIR PEG.js Grammar v3.0 - Fixed for PEG.js 0.7.0
// Parses MLIR operations in the format:
// %out = "dialect.OpName"(%in1, %in2) {attr-dict}: (type1, type2) -> type_out loc(#loc)
// Changes: SSA values can start with numbers, removed text() calls, support regions and empty types

{
  function buildOperation(output, opName, inputs, attrs, types, loc, regions) {
    return {
      output: output,
      opName: opName,
      inputs: inputs || [],
      regions: regions || [],
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
  = output:SSAValue _ "=" _ opName:OpName _ inputs:InputList? _ regions:RegionList? _ attrs:AttrDict? _ types:TypeSignature? _ loc:Location? _ {
      return buildOperation(output, opName, inputs, attrs, types, loc, regions);
    }
  / opName:OpName _ inputs:InputList? _ regions:RegionList? _ attrs:AttrDict? _ types:TypeSignature? _ loc:Location? _ {
      return buildOperation(null, opName, inputs, attrs, types, loc, regions);
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

RegionList
  = "(" _ regions:RegionSequence _ ")" { return regions; }

RegionSequence
  = first:Region rest:(_ "," _ Region)* {
      return [first].concat(rest.map(r => r[3]));
    }

Region
  = "{" _ ops:OperationLine* _ "}" { return ops; }

OperationLine
  = _ op:Operation _ { return op; }

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
  = DenseValue
  / StringLiteral
  / TypedValue
  / Identifier

DenseValue
  = "dense<" content:DenseContent ">" _ ":" _ type:Type {
      return 'dense<' + content + '> : ' + type;
    }

DenseContent
  = "[" values:DenseValueList "]" { return '[' + values + ']'; }
  / value:[^\]>]+ { return value.join(''); }

DenseValueList
  = first:DenseElement rest:(_ "," _ DenseElement)* {
      return first + rest.map(r => r[0] + r[1] + r[2] + r[3]).join('');
    }

DenseElement
  = sign:"-"? digits:[0-9]+ {
      return (sign || '') + digits.join('');
    }

TypedValue
  = value:NestedValue+ { return value.join(''); }

NestedValue
  = "<" content:NestedValue* ">" { return '<' + content.join('') + '>'; }
  / [^,}<>]+

StringLiteral
  = '"' chars:[^"]* '"' { return '"' + chars.join('') + '"'; }

NumberLiteral
  = digits:[0-9]+ decimal:("." [0-9]+)? {
      return digits.join('') + (decimal ? decimal[0] + decimal[1].join('') : '');
    }

TypeSignature
  = ":" _ "(" _ inputs:TypeList? _ ")" _ "->" _ output:TypeOrEmpty {
      return { inputs: inputs || [], output: output };
    }

TypeOrEmpty
  = "(" _ ")" { return "()"; }
  / Type

TypeList
  = first:Type rest:(_ "," _ Type)* {
      return [first].concat(rest.map(r => r[3]));
    }

Type
  = ComplexType / SimpleType

ComplexType
  = base:[a-zA-Z0-9_]+ "<" content:TypeContentWithHash ">" {
      return {
        kind: 'complex',
        base: base.join(''),
        content: content
      };
    }

TypeContentWithHash
  = parts:TypeContentPart+ {
      // Separate regular content from hash types
      let regularContent = [];
      let hashTypes = [];
      
      parts.forEach(part => {
        if (typeof part === 'object' && part.kind === 'hash') {
          hashTypes.push(part);
        } else {
          regularContent.push(part);
        }
      });
      
      return {
        text: regularContent.join('').trim().replace(/,\s*$/, ''),
        hashTypes: hashTypes
      };
    }

TypeContentPart
  = HashType
  / ComplexType
  / [^<>#]
  / "<" TypeContentWithHash ">"

HashType
  = "#" name:QualifiedName "<" attrs:HashTypeAttrs ">" {
      return {
        kind: 'hash',
        name: name,
        attributes: attrs
      };
    }

HashTypeAttrs
  = first:HashTypeAttr rest:(_ "," _ HashTypeAttr)* {
      const result = {};
      result[first.key] = first.value;
      rest.forEach(r => {
        result[r[3].key] = r[3].value;
      });
      return result;
    }

HashTypeAttr
  = key:Identifier _ "=" _ value:HashTypeValue {
      return { key: key, value: value };
    }

HashTypeValue
  = NestedAttrs
  / ArrayValue
  / SimpleValue

NestedAttrs
  = "<" attrs:NestedAttrList ">" {
      return attrs;
    }

NestedAttrList
  = first:NestedAttr rest:(_ "," _ NestedAttr)* {
      const result = {};
      result[first.key] = first.value;
      rest.forEach(r => {
        result[r[3].key] = r[3].value;
      });
      return result;
    }

NestedAttr
  = key:Identifier _ "=" _ value:NestedAttrValue {
      return { key: key, value: value };
    }

NestedAttrValue
  = NestedAttrs
  / ArrayValue
  / SimpleValue

ArrayValue
  = "[" content:[^\]]* "]" {
      const str = content.join('').trim();
      // Try to parse as array of numbers
      if (str.match(/^[\d\s,\-]+$/)) {
        return str.split(',').map(s => {
          const num = s.trim();
          return num ? (num.includes('-') ? parseInt(num) : parseInt(num)) : 0;
        });
      }
      return str;
    }

SimpleValue
  = chars:[^,<>\[\]]+ {
      const val = chars.join('').trim();
      // Try to parse as number
      if (val.match(/^-?\d+$/)) {
        return parseInt(val);
      }
      // Try to parse as typed number (e.g., "0 : si64")
      const typedMatch = val.match(/^(-?\d+)\s*:\s*(\w+)$/);
      if (typedMatch) {
        return {
          value: parseInt(typedMatch[1]),
          type: typedMatch[2]
        };
      }
      // Try to parse as boolean
      if (val === 'true') return true;
      if (val === 'false') return false;
      // Return as string
      return val;
    }

SimpleType
  = chars:[^,)\n\r\t <#]+ {
      return {
        kind: 'simple',
        value: chars.join('')
      };
    }

Location
  = "loc(" _ loc:LocationRef ")" { return loc; }

LocationRef
  = "#" ref:Identifier digits:[0-9]* { return '#' + ref + digits.join(''); }
  / chars:LocationContent { return chars; }

LocationContent
  = chars:(!(")" ![^)]) .)+ { return chars.map(c => c[1]).join('').trim(); }

Identifier
  = first:[a-zA-Z_] rest:[a-zA-Z0-9_]* { return first + rest.join(''); }

_ "whitespace"
  = [ \t\n\r]*