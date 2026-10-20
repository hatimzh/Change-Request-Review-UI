import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
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

	it('does not show actions for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		expect(fixture.nativeElement.querySelector('.cr-actions')).toBeNull();
	});

	it('renders the timeline chronologically without mutating the audit data', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const actions = Array.from(fixture.nativeElement.querySelectorAll('.cr-timeline__action')).map(
			(node: Element) => node.textContent,
		);

		expect(actions).toEqual(['CREATE', 'SUBMIT', 'SEND_FOR_APPROVAL']);
		expect(fixture.componentInstance.detail?.audit[0].action).toBe('SEND_FOR_APPROVAL');
	});

	it('approves the CR and updates the displayed status', async () => {
		const fixture = await render(users.approver, 'CR-1');
		await fixture.componentInstance.approve();
		fixture.detectChanges();

		expect(fixture.componentInstance.detail?.status).toBe('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
	});

	it('requires a non-whitespace rejection reason', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const component = fixture.componentInstance;
		component.rejectControl.setValue('   ');
		await component.reject();

		expect(component.rejectControl.invalid).toBe(true);
		expect(component.detail?.status).toBe('PENDING_APPROVAL');
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
