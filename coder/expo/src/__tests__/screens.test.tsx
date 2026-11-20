import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../lib/AppContext';
import { createAuth } from '../lib/auth';
import { createApi } from '../lib/api';
import { memoryKV } from '../lib/storage';
import { fakeFetch, SESSION } from '../testing/helpers';

jest.mock('expo-router', () => {
  const R = require('react');
  return {
    router: { replace: jest.fn(), push: jest.fn(), dismiss: jest.fn() },
    useLocalSearchParams: () => ({ id: 'p1' }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});

import SignIn from '../app/sign-in';
import Chats from '../app/chats';
import Chat from '../app/chat/[id]';
import Settings from '../app/settings';
import { router as mockRouter } from 'expo-router';

function setup(route: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch((url, init) => (url.endsWith('/api/auth/verify') ? { body: SESSION } : url.endsWith('/api/auth/signin') ? { body: { ticket: 'T' } } : route(url, init)));
  const auth = createAuth({ kv: memoryKV(), fetchFn: f });
  const api = createApi(auth, { fetchFn: f });
  const wrap = (el: React.ReactElement) => render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><AppProvider auth={auth} api={api}>{el}</AppProvider></SafeAreaProvider>);
  return { f, auth, api, wrap };
}

beforeEach(() => jest.clearAllMocks());

test('sign in: email, then the code, then the chats', async () => {
  const { wrap, f } = setup(() => undefined);
  await wrap(<SignIn />);
  await fireEvent.press(screen.getByTestId('go'));
  expect(await screen.findByText('Enter your email.')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('email'), 'me@example.com');
  await fireEvent.press(screen.getByTestId('go'));
  expect(await screen.findByText('Check your email')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('code'), '123456');
  await fireEvent.press(screen.getByTestId('go'));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/chats'));
  expect(f.calls.map((c) => c.url.replace(/^.*\/api\//, ''))).toEqual(['auth/signin', 'auth/verify']);
});

test('the chat list shows recents and opens a chat', async () => {
  const { wrap, auth } = setup((url) => (url.endsWith('/api/coder/projects') ? { body: { projects: [{ id: 'p1', repo: 'me/app', title: 'Fix login', status: 'running', at: Date.now() }, { id: 'p2', repo: 'me/site', title: '', at: Date.now() - 7200e3 }] } } : undefined));
  await auth.verifyCode('me@example.com', '1');
  await wrap(<Chats />);
  expect(await screen.findByText('Fix login')).toBeTruthy();
  expect(screen.getByText('Working')).toBeTruthy();
  expect(screen.getAllByText('me/site').length).toBeTruthy();
  await fireEvent.press(screen.getByTestId('chat-p1'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'p1' } });
});

test('a chat: answers in markdown, steps, a permission card, Stop and sending', async () => {
  const project = { id: 'p1', repo: 'me/app', title: 'Fix login', status: 'running', mode: 'auto', turn: 1 };
  const { wrap, auth, f } = setup((url) => {
    if (url.endsWith('/api/coder/settings')) return { body: { models: [{ id: 'grok-4.7', name: 'Grok 4.7', efforts: ['low', 'high'] }], pick: { model: 'grok-4.7', effort: 'low' }, prefs: {} } };
    if (url.endsWith('/api/coder/projects/p1')) return { body: { project, events: [
      { type: 'user', text: 'fix login' },
      { type: 'bash', id: 'c1', verb: 'Read', command: 'src/login.ts' }, { type: 'result', id: 'c1', code: 0 },
      { type: 'text', text: 'The **token** check was wrong.' },
      { type: 'permission', pid: 'k1', id: 'c2', tool: 'bash', lines: ['npm test'] },
    ] } };
    if (url.includes('/state?')) return { body: { running: true, next: 5, events: [] } };
    if (url.endsWith('/answer')) return { body: { ok: true } };
    if (url.endsWith('/stop')) return { body: { ok: true } };
    if (url.endsWith('/message')) return { body: { ok: true, queued: true, queue: [{ text: 'also' }] } };
  });
  await auth.verifyCode('me@example.com', '1');
  await wrap(<Chat />);
  expect(await screen.findByText('token')).toBeTruthy();
  expect(screen.getByText('Read src/login.ts')).toBeTruthy();
  expect(screen.getByText('Bash command')).toBeTruthy();
  expect(screen.getByTestId('working')).toBeTruthy();
  await fireEvent.press(screen.getByText('Yes'));
  await waitFor(() => expect(f.calls.some((c) => c.url.endsWith('/answer') && JSON.parse(c.init.body).choice === 'yes')).toBe(true));
  await fireEvent.press(screen.getByTestId('stop'));
  await waitFor(() => expect(f.calls.some((c) => c.url.endsWith('/stop'))).toBe(true));
  await fireEvent.changeText(screen.getByTestId('message'), 'also');
  await act(async () => { await fireEvent.press(screen.getByTestId('send')); });
  expect(await screen.findByText('1 message waiting for Coder')).toBeTruthy();
});

test('the mode picker changes the chat mode', async () => {
  const project = { id: 'p1', repo: 'me/app', status: 'idle', mode: 'auto' };
  const { wrap, auth, f } = setup((url) => {
    if (url.endsWith('/projects/p1')) return { body: { project, events: [] } };
    if (url.endsWith('/mode')) return { body: { project: { ...project, mode: 'plan', modeAt: 2 } } };
    if (url.endsWith('/settings')) return { body: { models: [], pick: { model: 'grok-4.7', effort: 'low' }, prefs: {} } };
  });
  await auth.verifyCode('me@example.com', '1');
  await wrap(<Chat />);
  expect(await screen.findByText(/What should Coder do/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('mode'));
  await fireEvent.press(screen.getByText('Plan'));
  await waitFor(() => expect(f.calls.some((c) => c.url.endsWith('/mode'))).toBe(true));
  expect(await screen.findByText('Plan ▾')).toBeTruthy();
});

test('settings shows who you are and signs out', async () => {
  const { wrap, auth } = setup((url) => (url.endsWith('/github') ? { body: { connected: true, login: 'octo' } } : url.endsWith('/settings') ? { body: { models: [{ id: 'grok-4.7', name: 'Grok 4.7', efforts: ['low'] }], pick: { model: 'grok-4.7', effort: 'low' }, prefs: {} } } : { body: {} }));
  await auth.verifyCode('me@example.com', '1');
  await wrap(<Settings />);
  expect(await screen.findByText('octo')).toBeTruthy();
  expect(screen.getByText('me@example.com')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('sign-out'));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in'));
  expect(auth.current()).toBeNull();
});
