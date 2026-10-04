import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { protocolFixture } from './fixture';

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe('App flow', () => {
  it('disables analyze with no photos and counts uploaded photos', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('button', { name: /analyze 0 photos/i })).toBeDisabled();

    await user.upload(screen.getByTestId('gallery-input'), [file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    expect(screen.getByRole('button', { name: /analyze 3 photos/i })).toBeEnabled();
    expect(screen.getByText('3 / 6 photos')).toBeInTheDocument();
  });

  it('analyzes and renders the protocol, then returns to capture for a missing slot', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(protocolFixture))));
    render(<App />);

    await user.upload(screen.getByTestId('gallery-input'), [file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    await user.click(screen.getByRole('button', { name: /analyze 3 photos/i }));

    expect(await screen.findByText('3 damages detected')).toBeInTheDocument();
    expect(screen.getByText(/2 minor · 1 moderate/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText(/Step 2 of 2 · Draft from 3 photos/)).toBeInTheDocument();
    expect(screen.getByText(/Not covered yet: right side, interior, dashboard/)).toBeInTheDocument();
    expect(within(screen.getByAltText('Left side').closest('.tile') as HTMLElement).getByLabelText('Damage 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add right side/i }));
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Right', selected: true })).toBeInTheDocument();
    expect(screen.getByText('3 / 6 photos')).toBeInTheDocument();
  });

  it('prefills mileage read from the dashboard photo and flags it for verification', async () => {
    const user = userEvent.setup();
    const protocol = { ...protocolFixture, vehicle: { ...protocolFixture.vehicle, mileageKm: 45123, mileageSource: 'photo' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(protocol))));
    render(<App />);
    await user.upload(screen.getByTestId('gallery-input'), [file('dash.jpg')]);
    await user.click(screen.getByRole('button', { name: /analyze 1 photo/i }));
    expect(await screen.findByLabelText('Mileage (km)')).toHaveValue('45123');
    expect(screen.getByText(/read from the dashboard photo/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mileage (km)'), '9');
    expect(screen.queryByText(/read from the dashboard photo/i)).not.toBeInTheDocument();
  });

  it('prefills the plate read from the photo but never overwrites a typed one', async () => {
    const user = userEvent.setup();
    const protocol = { ...protocolFixture, vehicle: { ...protocolFixture.vehicle, plate: 'ZZ-111', plateSource: 'photo' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(protocol))));
    render(<App />);
    await user.upload(screen.getByTestId('gallery-input'), [file('front.jpg')]);
    await user.click(screen.getByRole('button', { name: /analyze 1 photo/i }));
    expect(await screen.findByLabelText('Plate')).toHaveValue('ZZ-111');
    expect(screen.getByText(/read from the license plate photo/i)).toBeInTheDocument();
  });

  it('keeps a typed plate when the photo reading differs', async () => {
    const user = userEvent.setup();
    const protocol = { ...protocolFixture, vehicle: { ...protocolFixture.vehicle, plate: 'ZZ-111', plateSource: 'photo' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(protocol))));
    render(<App />);
    await user.type(screen.getByPlaceholderText('Plate number'), 'AB-1');
    await user.upload(screen.getByTestId('gallery-input'), [file('front.jpg')]);
    await user.click(screen.getByRole('button', { name: /analyze 1 photo/i }));
    expect(await screen.findByLabelText('Plate')).toHaveValue('AB-1');
  });

  it('shows an error with retry when the analysis fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<App />);
    await user.upload(screen.getByTestId('gallery-input'), [file('a.jpg')]);
    await user.click(screen.getByRole('button', { name: /analyze 1 photo/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i));
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
  });
});
