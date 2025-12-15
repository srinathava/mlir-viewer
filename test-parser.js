// Simple test script for the MLIR parser
const fs = require('fs');
const PEG = require('pegjs');

// Read the grammar
const grammarText = fs.readFileSync('mlir.pegjs', 'utf8');

// Build the parser
console.log('Building parser...');
const parser = PEG.generate(grammarText);
console.log('Parser built successfully!\n');

// Test cases
const testCases = [
    {
        name: 'Simple operation',
        input: '%0 = "arith.constant"() {value = 42 : i32} : () -> i32'
    },
    {
        name: 'Constant operation with dense and hash type',
        input: '%0 = "mhlo.constant"() {value = dense<[-208982, 155132]> : tensor<2xsi32>} : () -> tensor<2xsi32, #mhlo.TypeExt<memorySpace = global, layout = dense, encoding = compressed, offset = 0 : si64, shape = [2], isConstant = true>> loc(#loc3)'
    },
    {
        name: 'Quantize operation with nested sharding attributes',
        input: '%36 = "mhlo.quantize"(%35, %14) {axis = 2 : i64, scale = -1 : i64} : (tensor<1x1x2xsi32, #mhlo.TypeExt<memorySpace = local, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>>>, tensor<2xsi32, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = packed, sharding = <dims = [0, 0, 0, 0], strides = [2, 0, 0, 0]>, replication = <dims = [0, 0, 0, 0], strides = [2, 0, 0, 0]>, offset = 3095040 : si64, shape = [2]>>) -> tensor<1x1x2xsi10, #mhlo.TypeExt<memorySpace = local, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>>> loc(#loc24)'
    },
    {
        name: 'Dot operation with multiple regions',
        input: `%22 = "mhlo.dot_general"(%16, %20, %11) ({
      %35 = "mhlo.custom_call"() : () -> tensor<1x1x2xsi32, #mhlo.TypeExt<memorySpace = local, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>>> loc(#loc32)
      %36 = "mhlo.quantize"(%35, %21) {axis = 2 : i64, scale = -1 : i64} : (tensor<1x1x2xsi32, #mhlo.TypeExt<memorySpace = local, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>>>, tensor<2xsi32, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = packed, sharding = <dims = [0, 0, 0, 0], strides = [2, 0, 0, 0]>, replication = <dims = [0, 0, 0, 0], strides = [2, 0, 0, 0]>, offset = 3195392 : si64, shape = [2]>>) -> tensor<1x1x2xsi10, #mhlo.TypeExt<memorySpace = local, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>>> loc(#loc33)
    }, {
      "mhlo.barrier"(%21) : (tensor<2xsi32, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = packed, sharding = <dims = [0, 0, 0, 0], strides = [2, 0, 0, 0]>, replication = <dims = [0, 0, 0, 0], strides = [2, 0, 0, 0]>, offset = 3195392 : si64, shape = [2]>>) -> () loc(#loc34)
    }) {transpose_b = 0 : i64} : (tensor<1x1x1536xsi13, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = dense, sharding = <dims = [0, 0, 0, 0], strides = [1, 0, 0, 0]>, replication = <dims = [0, 0, 0, 0], strides = [1, 0, 0, 0]>, offset = 2996736 : si64, shape = [1, 1, 1536]>>, tensor<1536x2xsi8, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = dense, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, offset = 3145728 : si64, shape = [1536, 2]>>, tensor<2xsi32, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = compressed, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, offset = 3194880 : si64, shape = [2]>>) -> tensor<1x1x2xsi10, #mhlo.TypeExt<memorySpace = local, layout = row_major, encoding = dense, sharding = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, replication = <dims = [0, 2, 2, 2], strides = [2, 0, 0, 0]>, offset = 6288896 : si64, shape = [1, 1, 2]>> loc(#loc31)`
    },
    {
        name: 'Location with quoted string',
        input: '%0 = "arith.constant"() {value = 42 : i32} : () -> i32 loc("file.mlir")'
    },
    {
        name: 'Complex operation with nested hash types and quoted location',
        input: '%32 = "xba.Virtual"() : () -> tensor<1x1x2xsi32, #xml.XExt<bufferLoc =  local, sharding = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>, inferencing = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>>> loc("line_18")'
    },
    {
        name: 'MatMul with regions and multiple nested operations',
        input: `%14 = "xba.MatMul"(%13, %9, %10) ({
      %32 = "xba.Virtual"() : () -> tensor<1x1x2xsi32, #xml.XExt<bufferLoc =  local, sharding = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>, inferencing = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>>> loc("line_18")
      %33 = "xba.Quant"(%32, %11) {channel_dim = 2 : i64, scalar_param = -1 : i64} : (tensor<1x1x2xsi32, #xml.XExt<bufferLoc =  local, sharding = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>, inferencing = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>>>, tensor<2xsi32, #xml.XExt<bufferLoc =  local, bufferType =  L3_WEIGHT, fmt =  C32, sharding = <begin0 = [0, 0, 0, 0], stride0 = [2, 0, 0, 0]>, inferencing = <begin0 = [0, 0, 0, 0], stride0 = [2, 0, 0, 0]>, addr = -1 : si64, originShape = [2]>>) -> tensor<1x1x2xsi10, #xml.XExt<bufferLoc =  local, sharding = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>, inferencing = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>>> loc("line_19")
    }) {keepAlive = true, persistent = true, transpose_b = 0 : i64} : (tensor<1x1x1536xsi13, #xml.XExt<bufferLoc =  local, bufferType =  L3_IFM, fmt =  K8M32, sharding = <begin1 = [0, 0, 0, 0], stride1 = [1, 0, 0, 0]>, inferencing = <begin1 = [0, 0, 0, 0], stride1 = [1, 0, 0, 0]>, addr = -1 : si64, originShape = [1, 1, 1536]>>, tensor<1536x2xsi8, #xml.XExt<bufferLoc =  local, bufferType =  L3_WEIGHT, fmt =  K16N32, sharding = <begin1 = [0, 2, 2, 2], stride1 = [2, 0, 0, 0]>, inferencing = <begin1 = [0, 2, 2, 2], stride1 = [2, 0, 0, 0]>, addr = -1 : si64, originShape = [1536, 2]>>, tensor<2xsi32, #xml.XExt<bufferLoc =  local, bufferType =  L3_WEIGHT, fmt =  BIAS, sharding = <begin0 = [0, 2, 2, 2], stride0 = [2, 0, 0, 0]>, inferencing = <begin0 = [0, 2, 2, 2], stride0 = [2, 0, 0, 0]>, addr = -1 : si64, originShape = [2]>>) -> tensor<1x1x2xsi10, #xml.XExt<bufferLoc =  local, bufferType =  L3_OFM, fmt =  K32M32, sharding = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>, inferencing = <begin2 = [0, 2, 2, 2], stride2 = [2, 0, 0, 0]>, originShape = [1, 1, 2]>> loc("line_20")`
    }
];

testCases.forEach((testCase, index) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Input: ${testCase.input}\n`);
    
    try {
        const result = parser.parse(testCase.input);
        console.log('✓ Parse successful!');
        console.log('\nParsed result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('✗ Parse failed!');
        console.log(`Error: ${error.message}`);
        if (error.location) {
            console.log(`Location: line ${error.location.start.line}, column ${error.location.start.column}`);
        }
        if (error.expected) {
            console.log(`Expected: ${JSON.stringify(error.expected.slice(0, 5))}`);
        }
        if (error.found) {
            console.log(`Found: ${error.found}`);
        }
    }
});

console.log(`\n${'='.repeat(60)}`);
console.log('Testing complete!');
console.log(`${'='.repeat(60)}\n`);
