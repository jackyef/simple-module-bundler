const fs = require('fs');
const path = require('path');
const babylon = require('babylon');
const traverse = require('@babel/traverse').default;
const { transformFromAst } = require('@babel/core');

let _id = 0;

const createNode = (pathToFile) => {
  const content = fs.readFileSync(pathToFile, 'utf-8');

  const ast = babylon.parse(content, {
    sourceType: 'module',
  });

  const deps = [];

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      deps.push(node.source.value);
    },
  });
  
  return {
    id: _id++,
    filename: pathToFile,
    dependencies: deps,
    code: transformFromAst(ast).code,
  }
}

const createGraph = entry => {
  const mainNode = createNode(entry);

  const queue = [mainNode];
  
  for (const node of queue) {
    node.mapping = {};

    node.dependencies.forEach(relativePath => {
      const absolutePath = path.join(path.dirname(node.filename), relativePath);  
      const childNode = createNode(absolutePath);

      node.mapping[relativePath] = childNode.id;

      queue.push(childNode);
    })
  }

  return queue;
}

const bundle = graph => {
  const modules = graph.map(mod => {
    return `${mod.id}: 
    [
      function (require, module, exports) {
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)}
    ]`
  }).join(',');
  
  return `
    (function(modules){
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }

        const module = { exports : {} };
        fn(localRequire, module, module.exports);
        return module.exports;
      }

      require(0);
    })({ ${modules} })
  `
}

const entry = path.resolve(__dirname, './modules/index.js');
const graph = createGraph(entry);
const result = bundle(graph);

// console.log(graph);
console.log(result)