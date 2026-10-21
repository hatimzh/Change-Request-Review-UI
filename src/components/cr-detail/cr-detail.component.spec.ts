import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string, configureApi?: (api: CrApiService) => void): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	configureApi?.(fixture.debugElement.injector.get(CrApiService));
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded state
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('renders a load error with a retry action', async () => {
		const fixture = await render(users.approver, 'CR-1', (api) => {
			api.failNext = true;
		});

		expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-detail__error button')).not.toBeNull();
	});

	it('does not show actions for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		expect(fixture.nativeElement.querySelector('.cr-actions')).toBeNull();
	});

	it('renders the timeline chronologically without mutating the audit data', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const actions = Array.from(fixture.nativeElement.querySelectorAll('.cr-timeline__action')).map((node: Element) => node.textContent);

		expect(actions).toEqual(['CREATE', 'SUBMIT', 'SEND_FOR_APPROVAL']);
		expect(fixture.componentInstance.detail?.audit[0].action).toBe('SEND_FOR_APPROVAL');
	});

	it('renders description changes and the overall totals and delta', async () => {
		const fixture = await render(users.approver, 'CR-2');
		const changedRow = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="changed"]');

		expect(changedRow.textContent).toContain('Widget B');
		expect(changedRow.textContent).toContain('Widget B (new supplier)');
		expect(fixture.nativeElement.querySelector('.cr-detail__totals').textContent).toContain('USD 3,000.00');
		expect(fixture.nativeElement.querySelector('.cr-detail__delta').textContent).toContain('USD 0.00');
	});

	it('approves the CR and updates the displayed status', async () => {
		const fixture = await render(users.approver, 'CR-1');
		await fixture.componentInstance.approve();
		fixture.detectChanges();

		expect(fixture.componentInstance.detail?.status).toBe('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
	});

	it('shows an in-progress state and prevents duplicate approvals', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const api = fixture.debugElement.injector.get(CrApiService);
		api.latencyMs = 20;
		const approveSpy = jest.spyOn(api, 'approve');
		const firstAttempt = fixture.componentInstance.approve();
		fixture.detectChanges();

		expect(fixture.componentInstance.submitting).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__pending')).not.toBeNull();
		expect((fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).disabled).toBe(true);

		await fixture.componentInstance.approve();
		await firstAttempt;
		fixture.detectChanges();

		expect(approveSpy).toHaveBeenCalledTimes(1);
		expect(fixture.componentInstance.detail?.status).toBe('APPROVED');
	});

	it('requires a non-whitespace rejection reason', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		const rejectButton = fixture.nativeElement.querySelector('.cr-actions__reject-btn') as HTMLButtonElement;
		expect(rejectButton.disabled).toBe(true);
		component.rejectControl.setValue('   ');
		await component.reject();

		expect(component.rejectControl.invalid).toBe(true);
		expect(component.detail?.status).toBe('PENDING_APPROVAL');
	});

	it('rejects with a trimmed reason and adds the action to the timeline', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		component.rejectControl.setValue('  Incorrect quantity  ');

		await component.reject();
		fixture.detectChanges();

		expect(component.detail?.status).toBe('REJECTED');
		expect(component.detail?.audit[component.detail.audit.length - 1].note).toBe('Incorrect quantity');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('REJECTED');
	});

	it('keeps the CR pending and reports a failed rejection', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const api = fixture.debugElement.injector.get(CrApiService);
		api.failNext = true;
		fixture.componentInstance.rejectControl.setValue('Incorrect quantity');

		await fixture.componentInstance.reject();

		expect(fixture.componentInstance.detail?.status).toBe('PENDING_APPROVAL');
		expect(fixture.componentInstance.actionError).toBe('Network error');
		expect(fixture.componentInstance.submitting).toBe(false);
	});

	it('preserves the loaded CR and reports a failed approval', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const api = fixture.debugElement.injector.get(CrApiService);
		api.failNext = true;

		await fixture.componentInstance.approve();

		expect(fixture.componentInstance.detail?.status).toBe('PENDING_APPROVAL');
		expect(fixture.componentInstance.actionError).toBe('Network error');
		expect(fixture.componentInstance.submitting).toBe(false);
	});
});
