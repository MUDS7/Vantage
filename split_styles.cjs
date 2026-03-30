const fs = require('fs');
const path = require('path');

const files = [
  'e:/ai/Vantage/src/components/ChatInput.vue',
  'e:/ai/Vantage/src/components/ChatMessages.vue',
  'e:/ai/Vantage/src/components/FileManager.vue',
  'e:/ai/Vantage/src/components/FilePreview.vue'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  
  // match all style tags
  const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/g;
  let match;
  let newContent = content;
  let count = 0;
  
  while ((match = styleRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const attrs = match[1];
    const styleContent = match[2];
    
    // skip if it already has src
    if (attrs.includes('src=')) continue;
    
    const basename = path.basename(file, '.vue');
    const suffix = count === 0 ? '' : `_${count}`;
    const cssFileName = `${basename}${suffix}.css`;
    const cssFile = path.join(path.dirname(file), cssFileName);
    
    fs.writeFileSync(cssFile, styleContent.trim() + '\n', 'utf-8');
    
    const newTag = `<style${attrs} src="./${cssFileName}"></style>`;
    newContent = newContent.replace(fullMatch, newTag);
    count++;
    
    console.log(`Extracted style from ${path.basename(file)} to ${cssFileName}`);
  }
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log(`Updated ${path.basename(file)}`);
  }
});
