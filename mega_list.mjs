import { File } from 'megajs';

const url = 'https://mega.nz/folder/fEd0RCLT#Z2bEGVuHX-QouvXR8P0dCg';
const root = File.fromURL(url);
await root.loadAttributes();

function walk(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const kind = node.directory ? 'DIR ' : 'FILE';
    const size = node.directory ? '' : ` (${(node.size / 1024 / 1024).toFixed(2)} MB)`;
    console.log(`${indent}${kind} ${node.name}${size}`);
    if (node.children) {
        for (const child of node.children) walk(child, depth + 1);
    }
}

walk(root);
