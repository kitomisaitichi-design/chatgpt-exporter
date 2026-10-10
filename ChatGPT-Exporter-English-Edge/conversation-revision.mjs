// Compare authored conversation data separately from volatile server envelopes.
// The complete JSON is still exported and checksummed without modification.
function ordered(value) {
  if(Array.isArray(value))return value.map(ordered);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])]));
  return value;
}

export function conversationRevisionText(data) {
  if(!data?.mapping || typeof data.mapping!=='object')return JSON.stringify(ordered(data));
  const nodes=Object.keys(data.mapping).sort().map(id=>{
    const node=data.mapping[id],m=node?.message,meta=m?.metadata || {};
    return [id,node?.parent || null,[...(node?.children || [])].sort(),m ? {
      id:m.id || null,author:m.author || null,recipient:m.recipient || null,
      channel:m.channel || null,content:m.content || null,
      attachments:meta.attachments || null,
      content_references:meta.content_references || null,
      citations:meta.citations || null,
      hidden:!!meta.is_visually_hidden_from_conversation
    }:null];
  });
  return JSON.stringify(ordered({
    title:data.title || null,current_node:data.current_node || null,
    conversation_mode:data.conversation_mode || null,
    gizmo_id:data.gizmo_id || null,nodes
  }));
}
