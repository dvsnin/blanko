import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { UserProvider, useUser } from './UserContext';

function Probe() {
  const { workspaceName } = useUser();
  return <span data-testid="ws">{workspaceName}</span>;
}

describe('UserContext.workspaceName', () => {
  afterEach(() => { cleanup(); delete window.dashData; });

  it('берёт название сада из dashData.orgName', () => {
    window.dashData = { accountId: 'u1', name: 'Анна', email: 'a@x.ru', orgName: 'Солнышко' };
    render(<UserProvider><Probe /></UserProvider>);
    expect(screen.getByTestId('ws').textContent).toBe('Солнышко');
  });

  it('без организации - Blanko', () => {
    window.dashData = { accountId: 'u1', name: 'Анна', email: 'a@x.ru' };
    render(<UserProvider><Probe /></UserProvider>);
    expect(screen.getByTestId('ws').textContent).toBe('Blanko');
  });
});
