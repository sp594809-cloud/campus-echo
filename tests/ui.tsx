import assert from 'node:assert/strict';
import { renderToStaticMarkup } from '../artifacts/campus-echo/node_modules/react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import CampusNav from '../artifacts/campus-echo/src/components/campus-nav';
import ChatPage from '../artifacts/campus-echo/src/pages/chat';
import { Discussion } from '../artifacts/campus-echo/src/components/discussion';
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
function render(node: React.ReactNode) { return renderToStaticMarkup(<QueryClientProvider client={client}><Router ssrPath="/chat">{node}</Router></QueryClientProvider>); }
const navigation = render(<CampusNav />);
assert.match(navigation, /href="\/chat"/); assert.match(navigation, /aria-current="page"/); assert.match(navigation, />Feed</); assert.match(navigation, />Radar</);
const chat = render(<ChatPage />); assert.match(chat,/Everyone chat/); assert.match(chat,/Private chats &amp; Pings/); assert.match(chat,/No location permission needed/);
client.setQueryData(['discussion','alice','public'], {messages:[{id:1,alias:'Blue Owl',content:'<script>bad()</script>',createdAt:new Date().toISOString(),fromMe:false}]});
const conversation=render(<Discussion coords={{latitude:23,longitude:72}} />);
assert.match(conversation,/&lt;script&gt;bad\(\)&lt;\/script&gt;/); assert.doesNotMatch(conversation,/<script>/); assert.match(conversation,/Report/); assert.match(conversation,/Block/); assert.match(conversation,/textarea/); assert.doesNotMatch(conversation,/type="file"/);
client.clear();
console.log('PASS: visible Feed/Chat/Radar navigation, public/private chat destinations, location consent explanation, text-only composer and escaped user content.');
