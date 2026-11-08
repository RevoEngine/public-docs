export const makeQueue = (separate = false) => Array.from({ length: 6 }, (_, index) => ({
  id: 'Job ' + (index + 1), resource: index % 2 ? 'Invoices' : 'Orders',
  key: separate ? (index % 2 ? 'import_invoices' : 'import_orders') : 'shared_import',
  status: 'waiting', remaining: 3,
}));

export const advanceQueue = (jobs, limit) => {
  const next = jobs.map(job => job.status === 'running'
    ? { ...job, remaining: job.remaining - 1, status: job.remaining === 1 ? 'finished' : 'running' }
    : { ...job });
  const active = {};
  next.filter(job => job.status === 'running').forEach(job => { active[job.key] = (active[job.key] || 0) + 1; });
  next.forEach(job => {
    if (job.status === 'waiting' && (active[job.key] || 0) < limit) {
      job.status = 'running'; active[job.key] = (active[job.key] || 0) + 1;
    }
  });
  return next;
};

export const attemptKey = (state, operation, strategy) => {
  const number = state.attempts.length + 1;
  const key = strategy === 'random' ? 'request_' + number : strategy === 'global' ? 'issue_invoice' : 'invoice:' + operation + ':issue:v1';
  const admitted = !state.keys.includes(key);
  return { keys: admitted ? [...state.keys, key] : state.keys,
    attempts: [...state.attempts, { number, operation, key, admitted }] };
};

export const flowCatalog = {
  lowcode: { title: 'Admit a bounded section of code', intro: 'Explicit low-code concurrency returns an admission decision; it does not enqueue the caller.', cases: [
    { name: 'Admitted', steps: [
      ['Acquire', 'Derive a validated resource key and request one slot with an explicit TTL.', 'concurrencyLimit → true'],
      ['Work', 'Run the bounded operation and finish before the lease expires.', 'One acquired slot in use'],
      ['Release', 'Release exactly the slot this invocation acquired, including when its bounded operation throws.', 'releaseConcurrencyLimit → slot released'],
    ] },
    { name: 'Busy', steps: [
      ['Acquire', 'The key has no available slot under this limit.', 'concurrencyLimit → false', 'warning'],
      ['Return', 'Choose an application response or explicit retry policy. There is no automatic Job-style queue here. Do not release a slot you did not acquire.', 'BUSY · no protected work executed'],
    ] },
    { name: 'Work fails', steps: [
      ['Acquire', 'The invocation successfully acquires one slot.', 'concurrencyLimit → true'],
      ['Work', 'The bounded operation throws. A capacity slot is separate from business idempotency.', 'Operation failed', 'error'],
      ['Release', 'Use finally to release this acquired concurrency slot. Do not apply this rule to an idempotency key.', 'Capacity released · original failure retained'],
    ] },
  ] },
  endpoint: {
    title: 'Follow an Endpoint request',
    intro: 'POST /orders/order-1/confirm · inline or reusable request guard · modern HTTP response',
    cases: [
      { name: 'Valid request', steps: [
        ['Access', 'The caller is authenticated and permitted to invoke Endpoints. The configured execution identity governs later resource access.', 'Invocation allowed'],
        ['Route', 'Match the method and active path. Static routes take priority over less-specific dynamic candidates.', 'parameters.orderId = "order-1"'],
        ['Guard', 'Validate body, query, sanitized headers and path parameters before the business Component runs.', 'body.quantity = 2 → valid'],
        ['Component', 'Resolve the selected executable Component and run its elements in order. Business checks and resource permissions still apply.', 'Response = { accepted: true }'],
        ['Response', 'Select the visible Response element with popResult and use the configured success status.', '200 · { "accepted": true }'],
      ] },
      { name: 'Guard rejects input', steps: [
        ['Access', 'The caller has invocation access. Authentication does not validate business input.', 'Invocation allowed'],
        ['Route', 'The method and active route match the request.', 'POST /orders/:orderId/confirm'],
        ['Guard', 'This example guard requires a positive quantity. A quantity of zero fails before target Component execution.', 'quantity = 0 → rejected'],
        ['Rejected', 'Return the configured validation error. Modern responses default to 400; a deliberate override can use 422 and a safe custom body.', '400 · target Component did not run', 'error'],
      ] },
      { name: 'No matching route', steps: [
        ['Access', 'Check the caller before resolving the Endpoint.', 'Invocation allowed'],
        ['Route', 'No active Endpoint matches the method and path. Inactive definitions are not invokable.', '404 · no matching Endpoint', 'error'],
      ] },
      { name: 'Access denied', steps: [
        ['Access', 'A missing or invalid credential or missing invocation permission stops the request before the request guard and target Component.', 'Authentication or authorization error · no business execution', 'error'],
      ] },
      { name: 'Static response', steps: [
        ['Access', 'A static Endpoint still passes the normal invocation access boundary.', 'Invocation allowed'],
        ['Route', 'Match an active Endpoint with no target Component.', 'GET /health'],
        ['Guard', 'If configured, a request guard also validates a static Endpoint.', 'Configured guard passes'],
        ['Response', 'Return the configured static body and success status. There is no business Component to execute.', '200 · { "ready": true }'],
      ] },
    ],
  },
  storage: { title: 'Bytes are not yet a ready dataset', intro: 'A generated file, upload session and finalized Storage entry have different lifecycles.', cases: [
    { name: 'Asynchronous indexing', steps: [
      ['Session', 'Create an upload session with a declared file format and indexing policy.', 'Temporary upload session'],
      ['Transfer', 'Upload the bytes using the session contract. Transfer success alone is not publication.', 'Bytes received'],
      ['Finalize', 'Finalize and obtain the durable Storage entry identifier. File creation can trigger an Event.', 'Finalized entry · STORAGE_CREATED'],
      ['Index', 'With asynchronous indexing, structured statistics and records may still be pending.', 'Wait for structured readiness'],
      ['Read', 'Require successful synchronization before processing typed rows, and reload the entry under the executor’s permissions.', 'STORAGE_SYNCHRONIZED → bounded record reads'],
    ] },
    { name: 'Invalid synchronous CSV', steps: [
      ['Session', 'Choose synchronous CSV validation for this upload.', 'computeStats: "sync"'],
      ['Transfer', 'Byte transfer may succeed even when CSV records are malformed.', 'Bytes received'],
      ['Finalize', 'Malformed CSV fails validation before publication. Inspect the failed session; temporary bytes can remain.', 'STORAGE_CSV_INVALID · no finalized entry', 'error'],
    ] },
  ] },
  event: { title: 'Follow one Event delivery', intro: 'A subscription selects a target by event type and optional filter.', cases: [
    { name: 'Filter matches', steps: [
      ['Publish', 'A producer emits the configured event type and structured message.', 'message.region = "eu"'],
      ['Filter', 'The active subscription requires region equal to eu. In the visual editor, use region without the message prefix.', 'region eq eu → match'],
      ['Dispatch', 'Create work for the selected Job target under its configured execution policy.', 'Job accepted'],
      ['Observe', 'Follow the Event delivery and Job history separately. Successful dispatch does not prove the Job finished.', 'Inspect the Job terminal outcome'],
    ] },
    { name: 'Filter does not match', steps: [
      ['Publish', 'The event type matches, but the message belongs to another region.', 'message.region = "us"'],
      ['Filter', 'The subscription condition does not match. This subscription does not start its target.', 'No target dispatch for this subscription', 'warning'],
    ] },
    { name: 'Replay', steps: [
      ['History', 'Select an authorized historical event for replay.', 'Existing event message'],
      ['Dispatch', 'Replay uses current target definitions. The external world is not rolled back to the original event time.', 'A new delivery can reach business code'],
      ['Deduplicate', 'The application recognizes the same intended business operation and returns or reconciles its stored outcome.', 'Replay-safe effects require idempotency'],
    ] },
  ] },
  schedule: { title: 'Due time, admission and completion', intro: 'A Schedule defines eligibility; it does not promise an exact completion time.', cases: [
    { name: 'Job target', steps: [
      ['Configure', 'Select an active Schedule, a five-field cron expression and an IANA timezone.', '09:00 in the configured timezone'],
      ['Due', 'The next matching time makes the target eligible for dispatch.', 'Schedule delivery'],
      ['Inputs', 'Resolve Runtime input. Override shallowly overlays automation values; Replace uses only the automation object.', 'Effective templateInputs'],
      ['Admission', 'The Job still passes execution policy and configured concurrency. Lack of capacity can delay its start.', 'Accepted does not mean running'],
      ['Outcome', 'Read Schedule History for dispatch and Job History for the work result.', 'Verify the terminal Job outcome'],
    ] },
    { name: 'Paused Schedule', steps: [
      ['Pause', 'Pause the Schedule to stop future automatic dispatches.', 'Schedule inactive'],
      ['Existing work', 'Pausing does not cancel Jobs already accepted. Manage their lifecycle separately.', 'Existing Job may still complete', 'warning'],
    ] },
  ] },
  widget: { title: 'Refresh one cell, keep the input', intro: 'INPUT "name" → on.change → REFRESH "greeting"', cases: [
    { name: 'Valid partial result', steps: [
      ['Render', 'Initial source execution returns the name input and greeting cells with stable IDs.', 'name = Ada · greeting = Hello, Ada!'],
      ['Input', 'The operator enters Grace. The input commits according to its control settings.', '$widget.values.name = "Grace"'],
      ['Action', 'The declared on.change action requests a read for one target.', '$widget.targetIds = ["greeting"]'],
      ['Source', 'Branch on targetIds before fetching data. Return exactly the requested cell.', '[[{ id: "greeting", type: "TEXT", value: "Hello, Grace!" }]]'],
      ['Merge', 'Replace the greeting cell. Retain the existing input and its state in the mounted view.', 'name = Grace · greeting = Hello, Grace!'],
    ] },
    { name: 'Wrong returned ID', steps: [
      ['Action', 'The requested target is greeting.', 'targetIds = ["greeting"]'],
      ['Source', 'The source returns a cell named summary instead. The response does not satisfy the partial-result contract.', 'Returned IDs: ["summary"]'],
      ['Rejected', 'Reject the invalid partial result. Do not replace the requested cell with unrelated data.', 'No successful partial merge', 'error'],
    ] },
  ] },
  job: { title: 'A retry is a new attempt', intro: 'Template policy and the terminal outcome determine automatic application retries.', cases: [
    { name: 'Error then recovery', steps: [
      ['Accepted', 'Record durable work with its inputs and configured executor.', 'Attempt 1 pending'],
      ['Run', 'After admission, execute the Component within its budget.', 'Attempt 1 running'],
      ['Error', 'Record a terminal ERROR. An eligible template retry policy may create a child attempt.', 'Attempt 1 remains in history', 'warning'],
      ['Retry', 'The retry has its own identity and retry lineage. Reuse the intended business-operation key.', 'Attempt 2 · same business operation'],
      ['Verify', 'Inspect the successful attempt and its business evidence rather than treating dispatch as completion.', 'Attempt 2 FINISHED'],
    ] },
    { name: 'Capacity wait', steps: [
      ['Accepted', 'The Job exists but its concurrency bucket is full.', 'PENDING'],
      ['Wait', 'Wait and retry admission. This is not a terminal application error or a new retry child.', 'Concurrency wait reason', 'warning'],
      ['Run', 'When capacity becomes available, the admitted Job can execute.', 'Same attempt runs'],
    ] },
    { name: 'Uncertain external effect', steps: [
      ['Dispatch', 'Send an external mutation with the intended operation key.', 'Request sent'],
      ['Timeout', 'The response is lost. The destination may already have committed the effect.', 'Outcome unknown', 'warning'],
      ['Reconcile', 'Read business evidence or query the destination before repeating the effect.', 'Confirm outcome before retry'],
    ] },
  ] },
  transaction: { title: 'Where the transaction ends', intro: 'A local database transaction cannot roll back an independent external service.', cases: [
    { name: 'Local commit', steps: [
      ['Begin', 'Start a bounded transaction for related database changes.', 'Local transaction open'],
      ['Write', 'Update the order and its local reservation in the same transaction.', 'Changes not committed yet'],
      ['Commit', 'Commit the related local changes together.', 'Local state durable'],
      ['External work', 'Perform slow external work outside the transaction and record its outcome separately.', 'Reconcile independent effects'],
    ] },
    { name: 'Local failure', steps: [
      ['Begin', 'Start a transaction for related local writes.', 'Local transaction open'],
      ['Failure', 'A local write fails before commit.', 'Local transaction cannot complete', 'warning'],
      ['Rollback', 'Roll back the local transaction. This does not undo an external request made elsewhere.', 'Local changes not committed'],
    ] },
  ] },
  completion: { title: 'Accepted is not completed', intro: 'Return a durable operation identifier so the caller can observe the result.', cases: [
    { name: 'Background work', steps: [
      ['Request', 'Validate the command and its business-operation identity.', 'Valid command'],
      ['Accept', 'Create durable work and return its identifier.', '202 · { "jobId": "job-1" }'],
      ['Execute', 'The Job passes admission and performs its work. The original HTTP response is already complete.', 'Business work in progress'],
      ['Observe', 'The client polls or follows supported updates for that identifier.', 'Keep showing pending until confirmed'],
      ['Complete', 'The terminal execution outcome and required business receipt establish success.', 'Confirmed result'],
    ] },
    { name: 'Connection lost', steps: [
      ['Request', 'The command may reach the server before the connection is lost.', 'Receipt not received'],
      ['Unknown', 'No response is not proof that no Job was created.', 'Acceptance unknown', 'warning'],
      ['Recover', 'Look up the intended business operation using its stable identity before submitting it again.', 'Reconcile instead of blindly repeating'],
    ] },
  ] },
  revision: { title: 'Save, validate, activate', intro: 'This demonstration shows the hosted Custom Node.js revision lifecycle.', cases: [
    { name: 'Successful activation', steps: [
      ['Active', 'The existing selected revision continues serving consumers.', 'Revision A active'],
      ['Save', 'Save source for a candidate revision. Saving is not deployment readiness.', 'Revision B candidate · A still active'],
      ['Prepare', 'Build and validate the candidate. A failed candidate must not replace the working revision.', 'B ready for selection'],
      ['Activate', 'Select the ready revision after review.', 'New executions use B'],
    ] },
    { name: 'Candidate fails', steps: [
      ['Active', 'A verified revision is already selected.', 'Revision A active'],
      ['Prepare', 'A new candidate fails readiness checks.', 'Revision B not ready', 'error'],
      ['Continue', 'Keep serving the existing selected revision. Do not execute unverified saved source.', 'A remains active'],
    ] },
  ] },
  approval: { title: 'Review the exact proposed effect', intro: 'Example: an action that requires human approval under the selected policy.', cases: [
    { name: 'Approve', steps: [
      ['Investigate', 'Read authorized context and establish the concrete target and requested change.', 'Evidence for the proposal'],
      ['Propose', 'Present a reviewable action with its target, parameters and expected effect.', 'Awaiting approval'],
      ['Decide', 'The user approves this proposal. Approval does not expand roles or resource access.', 'Approval recorded'],
      ['Apply', 'Recheck the proposal and applicable permissions before applying the reviewed action.', 'Authorized change executed'],
      ['Verify', 'Inspect the result and report evidence. An approval alone is not completion.', 'Confirmed outcome'],
    ] },
    { name: 'Reject', steps: [
      ['Propose', 'The action is waiting for a user decision.', 'Awaiting approval'],
      ['Reject', 'The user rejects the proposed effect.', 'This proposed action is not executed', 'warning'],
    ] },
    { name: 'Target changed', steps: [
      ['Propose', 'The proposal describes one reviewed version and effect.', 'Reviewable change'],
      ['Approve', 'The user approves, but the target changes before application.', 'Proposal is stale', 'warning'],
      ['Review again', 'Prepare a fresh proposal instead of applying the old approval to a different state.', 'New review required'],
    ] },
  ] },
  authentication: { title: 'Identity, permission, action', intro: 'Knowing who calls is separate from allowing the requested operation.', cases: [
    { name: 'Allowed request', steps: [
      ['Authenticate', 'Verify the credential and its intended instance context.', 'Known identity'],
      ['Authorize', 'Check the required operation permissions and access to the target resource.', 'Target access allowed'],
      ['Validate', 'Validate the public request contract. A valid credential does not make invalid input acceptable.', 'Valid request'],
      ['Execute', 'Perform the permitted action and inspect its response or asynchronous operation ID.', 'Authorized result'],
    ] },
    { name: 'Insufficient access', steps: [
      ['Authenticate', 'The credential identifies the caller successfully.', 'Known identity'],
      ['Authorize', 'The identity lacks a required permission or target grant.', 'Operation denied', 'error'],
    ] },
  ] },
  pagination: { title: 'A page is not the whole dataset', intro: 'This example follows a structured Storage cursor while keeping memory bounded.', cases: [
    { name: 'Read all pages', steps: [
      ['Page 1', 'Request a bounded page. Keep filters and read policy stable for the scan.', 'rows: 2 · next: true · nextCursor present'],
      ['Process', 'Await processing of this batch before moving on. Release rows that no longer need to be retained.', '2 rows processed'],
      ['Continue', 'Follow the returned cursor instead of guessing that the first page was complete.', 'rows: 1 · next: false'],
      ['Finish', 'Stop when the returned continuation contract says the scan is complete.', '3 rows processed · complete scan'],
    ] },
    { name: 'Show a preview', steps: [
      ['Read', 'Fetch one bounded page for a widget.', '2 rows · more available'],
      ['Label', 'Show the result as a preview. Do not calculate a whole-dataset total from the first page.', 'Partial result, not a complete total', 'warning'],
    ] },
  ] },
  streaming: { title: 'Follow the stream boundary', intro: 'Default SSE event names shown; application event names and disconnect policy are configurable.', cases: [
    { name: 'Successful stream', steps: [
      ['Admission', 'Check access, route and request guard before opening the stream.', 'Admission passes'],
      ['Open', 'Start the SSE response. Once open, its HTTP status is 200.', '200 · text/event-stream'],
      ['Progress', 'Deliver application progress frames while the Component runs. A progress frame is not the final outcome.', 'event: progress'],
      ['Result', 'After Component completion, emit the configured visible result unless noResult suppresses it.', 'event: result'],
      ['Done', 'Emit the completion frame. The client reads its terminal error flag.', 'event: done · { "error": false }'],
    ] },
    { name: 'Guard fails', steps: [
      ['Admission', 'The request fails guard validation before streaming starts.', 'Ordinary HTTP validation error', 'error'],
    ] },
    { name: 'Error after open', steps: [
      ['Open', 'Admission passed and the response is already streaming.', 'HTTP 200 already sent'],
      ['Error', 'The execution fails. Report the error through the stream rather than interpreting HTTP 200 as success.', 'event: error', 'error'],
      ['Done', 'Finish with the error flag. Preserve the confirmed failure in the UI.', 'event: done · { "error": true }', 'error'],
    ] },
  ] },
  permissions: { title: 'Role and resource access are separate', intro: 'Example: a workload reads a restricted Table through the Platform API.', cases: [
    { name: 'Role and ACL allow', steps: [
      ['Identity', 'The workload authenticates as its active Service Account with platform access enabled.', 'Known execution principal'],
      ['Role', 'Its effective permissions include the required read capability.', 'Operation permitted by role'],
      ['Resource', 'The restricted Table admits this principal through its configured access policy.', 'Resource access permitted'],
      ['Read', 'The query is validated and returns its bounded result.', 'Read admitted'],
    ] },
    { name: 'Role without resource access', steps: [
      ['Identity', 'The workload authenticates successfully.', 'Identity accepted'],
      ['Role', 'A read role exists, but it does not make every restricted Table accessible.', 'Capability alone is insufficient'],
      ['Resource', 'The target access policy does not admit this principal. Review the exact workload identity and ACL.', 'No Table data returned', 'error'],
    ] },
  ] },
  vault: { title: 'A connection is not a workload grant', intro: 'Personal Vault example: the user connects an external account and grants a named consumer.', cases: [
    { name: 'Connected and granted', steps: [
      ['Connect', 'The user consents to the external account connection.', 'Connection available to its owner'],
      ['Grant', 'The owner grants the specific Vault name to the intended Component or plugin.', 'Explicit consumer binding'],
      ['Resolve', 'Trusted execution resolves the credential for the current identity and consumer.', 'Credential stays out of model output'],
      ['Authorize', 'The action still needs local permission, applicable approval and remote account scope.', 'Attempt the permitted operation'],
    ] },
    { name: 'Missing consumer grant', steps: [
      ['Connect', 'The owner has a valid external account connection.', 'Connection exists'],
      ['Resolve', 'Another Component requests the value without the required grant.', 'Credential resolution denied', 'error'],
      ['Fix', 'The owner reviews and grants the intended consumer, then tests its actual execution path.', 'Do not copy the token into instructions'],
    ] },
  ] },
  realtime: { title: 'Recover after a connection gap', intro: 'Realtime improves freshness; the Platform API holds authoritative resource state.', cases: [
    { name: 'Reconnect and refetch', steps: [
      ['Read', 'Load the current resource through the authorized API.', 'Visible version 4'],
      ['Disconnect', 'The browser loses its connection while the resource changes.', 'An update can be missed', 'warning'],
      ['Reconnect', 'Restore eligible authentication and rejoin supported channels.', 'Connection restored; history not replayed'],
      ['Refetch', 'Read authoritative state again rather than assuming the visible version is current.', 'Visible version 6'],
    ] },
    { name: 'Late duplicate update', steps: [
      ['Current', 'The client already shows resource version 6.', 'Version 6'],
      ['Notify', 'A delayed notification refers to an older observed version.', 'Version 5 notification'],
      ['Compare', 'A version-aware client does not regress its view. Refetch when the notification is insufficient.', 'Keep version 6'],
    ] },
  ] },
  cache: { title: 'Rebuild a cache miss', intro: 'Application cache is derived state. Durable admission helpers have a separate lifetime and purpose.', cases: [
    { name: 'Expired value', steps: [
      ['Lookup', 'The configured application-cache TTL has elapsed.', 'Cache miss'],
      ['Load', 'Read the value from its authoritative Table or external system.', 'Current source value'],
      ['Cache', 'Store a compact result with an appropriate TTL.', 'Later reads can reuse the value'],
    ] },
    { name: 'Concurrent misses', steps: [
      ['Lookup', 'Two callers both observe a missing key.', 'Two cache misses'],
      ['Load', 'Both can perform the upstream read before either stores its result.', 'Atomic cache insertion does not deduplicate prior calls', 'warning'],
      ['Coordinate', 'Use an appropriate admission primitive when duplicate upstream work matters, and retain a cache-miss path.', 'A normal get/set pair is not a lock'],
    ] },
  ] },
  view: { title: 'Preview the source mutation', intro: 'A Structured View is read-only; a governed action separately targets a source Table with direct key lineage.', cases: [
    { name: 'Reviewed action', steps: [
      ['Select', 'Choose a supported source action on a saved Structured View with a complete direct source key.', 'One target Table'],
      ['Preview', 'Review the affected count and sample keys returned by the action preview.', 'Caller-bound mutation token'],
      ['Apply', 'Submit the intended update with the valid token. Source permissions and validation still apply.', 'Source Table mutation'],
    ] },
    { name: 'View changed after preview', steps: [
      ['Preview', 'Review the action against the current View version.', 'Preview token issued'],
      ['Change', 'The View definition changes, or its materialization is refreshed.', 'Earlier token is stale'],
      ['Apply', 'The stale token cannot authorize this changed workset. Obtain and review a fresh preview.', 'Old preview rejected', 'error'],
    ] },
  ] },
  batching: { title: 'A request batch is not a transaction', intro: 'SDK failureMode changes how individual calls are attempted; it does not roll back earlier effects.', cases: [
    { name: 'Stop on first failure', steps: [
      ['Batch', 'Submit three ordered calls with failureMode: stop.', 'A, B, C'],
      ['A', 'Call A completes its mutation.', 'A committed'],
      ['B', 'Call B rejects.', 'B failed', 'error'],
      ['C', 'Later entries fail with BATCH_STOPPED. A is not rolled back.', 'C not executed; inspect A before retrying'],
    ] },
    { name: 'Independent calls', steps: [
      ['Batch', 'Submit calls with failureMode: independent.', 'Each promise has its own outcome'],
      ['Results', 'B fails, while valid A and C can succeed.', 'Partial success is possible', 'warning'],
      ['Recover', 'Inspect each result and reconcile uncertain mutations. Runtime batches are not automatically retried.', 'Retry only work proved safe'],
    ] },
  ] },
  cli: { title: 'Compare local, baseline and remote', intro: 'Component synchronization checks the last synchronized baseline before replacing current source.', cases: [
    { name: 'Only remote changed', steps: [
      ['Baseline', 'Local source still matches the last synchronized baseline.', 'No local edits'],
      ['Compare', 'The remote Component contains a newer change.', 'Remote-only change'],
      ['Pull', 'A normal pull can fast-forward the clean local copy and record the new baseline.', 'Local source follows remote'],
    ] },
    { name: 'Both sides changed', steps: [
      ['Edit', 'Local and remote source have both changed from the baseline.', 'Divergent changes'],
      ['Compare', 'Normal synchronization reports the conflict instead of choosing by timestamp.', 'Review required', 'warning'],
      ['Resolve', 'Read the current remote source, reconcile the intended changes and review a fresh plan.', 'A forced overwrite is a separate deliberate choice'],
    ] },
  ] },
  nativeTests: { title: 'Evidence belongs to captured source', intro: 'Fixture tests evaluate captured Component source and explicit effect fixtures; they do not deploy it.', cases: [
    { name: 'Passing captured source', steps: [
      ['Capture', 'Capture the suite, target source and declared fixtures.', 'Retained run ID'],
      ['Execute', 'Await cases and assertions against that capture.', 'Completed assertions'],
      ['Result', 'A passing run proves the tested expectations for that capture. Review deployment separately.', 'PASSED is not activation'],
    ] },
    { name: 'Edit after capture', steps: [
      ['Capture', 'The earlier run captured version A.', 'Evidence for A'],
      ['Edit', 'The candidate changes to B after that capture.', 'Source changed'],
      ['Retest', 'The old PASS does not prove B. Capture and execute the changed candidate.', 'New evidence required', 'warning'],
    ] },
  ] },
  evidence: { title: 'Follow evidence to the outcome', intro: 'An operation receipt, logs and business completion answer different questions.', cases: [
    { name: 'Confirmed background result', steps: [
      ['Receipt', 'The caller receives the durable operation or Job identifier.', 'Accepted'],
      ['History', 'Inspect the corresponding Job and the relevant attempt lineage.', 'Terminal execution outcome'],
      ['Business', 'Verify the stored business result or finalized artifact referenced by that execution.', 'Evidence for the intended result'],
    ] },
    { name: 'Incomplete evidence', steps: [
      ['Investigate', 'Open the exact identifier and the appropriate UTC time range.', 'Scoped investigation'],
      ['Coverage', 'Some details are unavailable, redacted, truncated or outside retention.', 'Partial coverage', 'warning'],
      ['Conclude', 'State what is confirmed and what is unknown; query the authoritative resource or receiver before retrying.', 'Missing logs do not prove no effect'],
    ] },
  ] },
  mcp: { title: 'Session admission and tool outcome', intro: 'The MCP session belongs to the credential and instance that created it.', cases: [
    { name: 'Initialize and call', steps: [
      ['Initialize', 'Authenticate and negotiate a session.', 'Retain Mcp-Session-Id'],
      ['Discover', 'Acknowledge initialization and discover the currently visible tool contract.', 'Current schema and capabilities'],
      ['Call', 'Submit a valid authorized tool request under that session.', 'HTTP response received'],
      ['Inspect', 'Read the JSON-RPC and tool result. HTTP 200 alone does not establish a successful business action.', 'Inspect result, errors and durable IDs'],
    ] },
    { name: 'Credential changed', steps: [
      ['Rotate', 'The client changes its API key.', 'New credential'],
      ['Reuse', 'The old session cannot transfer its authority to the new key.', 'Old session rejected', 'error'],
      ['Initialize', 'Establish a fresh session and rediscover the current contract before new work.', 'Reconcile any interrupted mutation separately'],
    ] },
  ] },

};

export const PlaygroundStyle = () => <style>{`
  .revo-demo {
    --rd-border: #ccd7df; --rd-muted: #455665; --rd-panel: #f3f7fa;
    --rd-accent: #006e65; --rd-active: #d9f2ed; --rd-error: #a92c38;
    --rd-warning: #8a5406; --rd-alt: #6343a4; --rd-alt-bg: #ece6fa;
    color: #172636; background: #fff; border: 1px solid var(--rd-border);
    border-radius: 14px; margin: 1.25rem 0 1.75rem; padding: 16px;
    font-size: 14px; line-height: 1.45; overflow-wrap: anywhere;
  }
  .dark .revo-demo {
    --rd-border: #465564; --rd-muted: #becbd5; --rd-panel: #1c2a37;
    --rd-accent: #70dfca; --rd-active: #16493f; --rd-error: #ffa5ab;
    --rd-warning: #ffcd79; --rd-alt: #d2b7ff; --rd-alt-bg: #3f315b;
    color: #eef5fa; background: #14212e;
  }
  .revo-demo * { box-sizing: border-box; }
  .revo-demo h3 { margin: 0; color: inherit; font-size: 18px; line-height: 1.25; font-weight: 650; }
  .revo-demo p { margin: 0; }
  .revo-demo .rd-toolbar, .revo-demo .rd-controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .revo-demo .rd-toolbar { justify-content: space-between; margin: 10px 0; }
  .revo-demo .rd-controls { margin: 8px 0; }
  .revo-demo button, .revo-demo select {
    min-height: 44px; max-width: 100%; padding: 5px 10px; color: inherit; background: var(--rd-panel);
    border: 1px solid var(--rd-border); border-radius: 8px; font: inherit; cursor: pointer;
  }
  .revo-demo button:hover:not(:disabled) { border-color: var(--rd-accent); }
  .revo-demo button:disabled { opacity: .55; cursor: default; }
  .revo-demo button.rd-primary { background: #006e65; border-color: #006e65; color: #fff; }
  .revo-demo :is(button, select, input, summary):focus-visible { outline: 2px solid var(--rd-accent); outline-offset: 2px; }
  .revo-demo label { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: center; min-width: 0; }
  .revo-demo label:has(input[type="checkbox"]) { min-height: 44px; cursor: pointer; }
  .revo-demo details { margin: 4px 0 0; }
  .revo-demo summary { display: list-item; width: fit-content; min-height: 44px; padding: 11px 0; color: var(--rd-accent); cursor: pointer; }
  .revo-demo code { font: 12px/1.35 ui-monospace, monospace; color: inherit; background: none; }
  .revo-demo .rd-muted, .revo-demo .rd-footnote { color: var(--rd-muted); }
  .revo-demo .rd-footnote { margin: 8px 0 0; font-size: 12px; }
  .revo-demo .rd-intro { margin: 5px 0 0; color: var(--rd-muted); font-size: 13px; }
  .revo-demo .rd-track, .revo-demo .rd-rows { list-style: none; padding: 6px 9px; margin: 0; background: var(--rd-panel); border: 1px solid var(--rd-border); border-radius: 9px; }
  .revo-demo .rd-step { position: relative; margin: 0; }
  .revo-demo .rd-step-link { position: absolute; pointer-events: none; left: 19px; top: calc(50% + 10px); height: calc(100% - 20px); width: 2px; background: var(--rd-border); }
  .revo-demo .rd-step-link i {
    display: block; height: 100%; background: var(--rd-accent); transform: scaleY(0);
    transform-origin: top; transition: transform .3s ease-out;
  }
  .revo-demo .rd-step[data-state="seen"] .rd-step-link i { transform: scaleY(1); }
  .revo-demo .rd-step button {
    display: grid; grid-template-columns: 24px minmax(70px, .45fr) minmax(0, 1fr);
    align-items: center; gap: 8px; width: 100%; text-align: left; padding: 5px 8px; border-color: transparent; background: transparent;
  }
  .revo-demo .rd-step button[aria-current="step"] { background: var(--rd-active); animation: rd-arrive .3s ease-out; }
  .revo-demo .rd-step-number {
    display: grid; place-items: center; z-index: 1; border: 1px solid var(--rd-border); border-radius: 50%;
    width: 24px; height: 24px; background: var(--rd-panel); font-weight: 700; font-size: 12px;
  }
  .revo-demo .rd-step[data-state="seen"] .rd-step-number,
  .revo-demo .rd-step button[aria-current="step"] .rd-step-number { background: var(--rd-accent); color: var(--rd-panel); border-color: var(--rd-accent); }
  .revo-demo [data-tone="error"] { color: var(--rd-error); }
  .revo-demo [data-tone="warning"] { color: var(--rd-warning); }
  .revo-demo .rd-step-copy { margin-top: 8px; min-height: 2.9em; color: var(--rd-muted); font-size: 13px; }
  .revo-demo .rd-board {
    position: relative; display: grid; grid-template-columns: minmax(74px, auto) minmax(0, 1fr);
    grid-template-rows: repeat(3, 38px); align-items: center; column-gap: 6px;
    border: 1px solid var(--rd-border); border-radius: 9px; padding: 4px 6px;
    background: var(--rd-panel);
  }
  .revo-demo .rd-lane-name { grid-column: 1; padding-left: 4px; font-size: 12px; font-weight: 650; }
  .revo-demo .rd-lane {
    grid-column: 2; height: 32px; border-radius: 6px;
    background: repeating-linear-gradient(90deg, transparent 0, transparent calc(100% / 6 - 1px), var(--rd-border) calc(100% / 6 - 1px), var(--rd-border) calc(100% / 6));
  }
  .revo-demo .rd-slots { grid-area: 2 / 2; position: relative; height: 32px; }
  .revo-demo .rd-slot, .revo-demo .rd-job {
    position: absolute; width: min(28px, calc(100% / 6 - 2px)); height: 27px; border-radius: 6px;
    left: calc((var(--rd-index) + .5) * 100% / 6); transform: translateX(-50%);
  }
  .revo-demo .rd-slot {
    top: 2px; display: grid;
    place-items: center; color: var(--rd-muted); font-size: 10px; border: 1px dashed var(--rd-muted);
  }
  .revo-demo .rd-tokens { grid-area: 1 / 2 / span 3; height: 100%; position: relative; pointer-events: none; }
  .revo-demo .rd-job {
    top: calc(var(--rd-row) * 38px + 5px);
    transition: left .42s ease, top .42s ease, background .25s ease;
    display: grid; place-items: center; overflow: hidden; font-size: 11px; font-weight: 750;
    background: var(--rd-active); border: 1px solid var(--rd-accent); color: var(--rd-accent);
  }
  .revo-demo .rd-job[data-kind="Invoices"] { background: var(--rd-alt-bg); color: var(--rd-alt); border-color: var(--rd-alt); }
  .revo-demo .rd-job i { position: absolute; bottom: 0; left: 0; height: 3px; background: currentColor; transition: width .42s ease; }
  .revo-demo .rd-legend { display: flex; gap: 10px; flex-wrap: wrap; margin: 7px 0; color: var(--rd-muted); font-size: 12px; }
  .revo-demo .rd-legend b { color: var(--rd-accent); }
  .revo-demo .rd-legend b[data-kind="Invoices"] { color: var(--rd-alt); }
  .revo-demo .rd-status { margin: 6px 0; font-size: 13px; font-variant-numeric: tabular-nums; }
  .revo-demo .rd-row {
    display: grid; grid-template-columns: minmax(62px, .55fr) minmax(0, 1fr) minmax(64px, auto);
    align-items: center; gap: 8px; min-height: 40px; margin: 0; padding: 5px 6px; border-radius: 6px;
    font-size: 12px;
  }
  .revo-demo .rd-row + .rd-row { border-top: 1px solid var(--rd-border); }
  .revo-demo .rd-row[aria-current="step"] { background: var(--rd-active); animation: rd-arrive .3s ease-out; }
  .revo-demo .rd-row[data-state="future"] { color: var(--rd-muted); }
  .revo-demo .rd-row > :last-child { text-align: right; font-weight: 650; }
  .revo-demo .rd-result { display: block; margin: 0; padding: 8px 10px; white-space: pre-wrap; border-radius: 8px; background: var(--rd-panel); }
  .revo-demo .rd-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @keyframes rd-arrive { from { transform: translateY(2px); } to { transform: translateY(0); } }
  @media (max-width: 480px) {
    .revo-demo { padding: 11px; }
    .revo-demo select { font-size: 16px; }
    .revo-demo .rd-track, .revo-demo .rd-rows { padding: 4px; }
    .revo-demo .rd-step button { grid-template-columns: 24px minmax(54px, .5fr) minmax(0, 1fr); gap: 6px; }
    .revo-demo .rd-row { gap: 5px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .revo-demo * { animation: none !important; transition: none !important; }
    .revo-demo .rd-playback { display: none; }
  }
`}</style>;

export const useDemoPlayback = (playing, advance, stop) => {
  useEffect(() => {
    if (!playing) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) { stop(); return; }
    let frame, elapsed = 0, previous;
    const tick = now => {
      if (previous !== undefined && !document.hidden) elapsed += Math.min(now - previous, 100);
      previous = now;
      if (elapsed >= 1400) { advance(); elapsed = 0; }
      frame = requestAnimationFrame(tick);
    };
    const reduce = () => { if (motion.matches) stop(); };
    const resetClock = () => { previous = undefined; };
    motion.addEventListener('change', reduce);
    document.addEventListener('visibilitychange', resetClock);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', reduce);
      document.removeEventListener('visibilitychange', resetClock);
    };
  }, [playing, advance, stop]);
};

export const FlowDemo = ({ topic }) => {
  const flow = flowCatalog[topic];
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scenario = flow.cases[selected];
  const steps = scenario.steps;
  const current = steps[step];
  const done = step === steps.length - 1;
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => setStep(value => Math.min(value + 1, steps.length - 1)), [steps.length]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (done) stop(); }, [done, stop]);

  const togglePlayback = () => {
    if (done) setStep(0);
    setPlaying(!playing);
  };

  return <section className="revo-demo not-prose" aria-label={flow.title}>
    <PlaygroundStyle />
    <h3>{flow.title}</h3>
    <p className="rd-intro">{flow.intro}</p>
    <div className="rd-toolbar">
      <select aria-label="Scenario" value={selected} onChange={event => { stop(); setSelected(Number(event.target.value)); setStep(0); }}>
        {flow.cases.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}
      </select>
      <div className="rd-controls">
        <button type="button" className="rd-primary rd-playback" onClick={togglePlayback} disabled={steps.length === 1} aria-pressed={playing}>{playing ? 'Pause' : done ? 'Replay' : 'Play'}</button>
        <button type="button" disabled={done} onClick={() => { stop(); advance(); }}>Next step</button>
      </div>
    </div>
    <ol className="rd-track">
      {steps.map(([name, , outcome, tone], index) => <li className="rd-step" key={index} data-state={index < step ? 'seen' : 'upcoming'}>
        {index < steps.length - 1 && <span className="rd-step-link" aria-hidden="true"><i /></span>}
        <button type="button" aria-current={index === step ? 'step' : undefined} onClick={() => { stop(); setStep(index); }}>
          <span className="rd-step-number" aria-hidden="true">{index + 1}</span>
          <strong>{name}</strong>
          <code data-tone={tone}>{outcome}</code>
        </button>
      </li>)}
    </ol>
    <p className="rd-step-copy">{current[1]}</p>
    <p className="rd-visually-hidden" role="status" aria-live="polite">Step {step + 1} of {steps.length}. {current[0]}. {current[2]}.</p>
    <p className="rd-footnote">Illustration only. Select a step to inspect it or return to the start.</p>
  </section>;
};

export const ConcurrencyDemo = ({ keys = false }) => {
  const [separate, setSeparate] = useState(false);
  const [limit, setLimit] = useState(2);
  const [jobs, setJobs] = useState(() => makeQueue(false));
  const [playing, setPlaying] = useState(false);
  const done = jobs.every(job => job.status === 'finished');
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => setJobs(value => advanceQueue(value, limit)), [limit]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (done) stop(); }, [done, stop]);

  const reset = (nextSeparate, nextLimit) => {
    stop();
    setSeparate(nextSeparate);
    setLimit(nextLimit);
    setJobs(makeQueue(nextSeparate));
  };
  const waiting = jobs.filter(job => job.status === 'waiting');
  const running = jobs.filter(job => job.status === 'running');
  const finished = jobs.filter(job => job.status === 'finished');
  const capacity = separate ? limit * 2 : limit;
  const lanes = [waiting, running, finished];
  const indexInLane = job => {
    if (job.status === 'running' && separate) {
      return running.filter(item => item.key === job.key).indexOf(job) + (job.resource === 'Invoices' ? 3 : 0);
    }
    return lanes.find(items => items.includes(job)).indexOf(job);
  };

  return <section className="revo-demo not-prose" aria-label={keys ? 'Compare coordination keys' : 'Explore Job concurrency'}>
    <PlaygroundStyle />
    <h3>{keys ? 'Same key, shared capacity' : 'Six Jobs, limited capacity'}</h3>
    <div className="rd-toolbar">
      <code>{separate ? 'import_orders · import_invoices' : 'shared_import'} · {limit} {limit === 1 ? 'slot' : 'slots'} per key</code>
      <div className="rd-controls">
        <button type="button" className="rd-primary rd-playback" aria-pressed={playing} onClick={() => {
          if (done) setJobs(makeQueue(separate));
          setPlaying(!playing);
        }}>{playing ? 'Pause' : done ? 'Replay' : 'Play'}</button>
        <button type="button" disabled={done} onClick={() => { stop(); advance(); }}>Next step</button>
      </div>
    </div>
    <div className="rd-board" aria-hidden="true">
      <span className="rd-lane-name" style={{ gridRow: 1 }}>Waiting</span><span className="rd-lane" style={{ gridRow: 1 }} />
      <span className="rd-lane-name" style={{ gridRow: 2 }}>Running</span><span className="rd-lane" style={{ gridRow: 2 }} />
      <span className="rd-lane-name" style={{ gridRow: 3 }}>Finished</span><span className="rd-lane" style={{ gridRow: 3 }} />
      <div className="rd-slots">
        {Array.from({ length: capacity }, (_, index) => <span className="rd-slot" key={index} style={{ '--rd-index': separate && index >= limit ? 3 + index - limit : index }}>{separate ? index < limit ? 'O' : 'I' : '·'}</span>)}
      </div>
      <div className="rd-tokens">
        {jobs.map((job, index) => <span className="rd-job" key={job.id} title={job.id + ' · ' + job.resource} data-kind={job.resource} data-status={job.status} style={{ '--rd-index': indexInLane(job), '--rd-row': job.status === 'waiting' ? 0 : job.status === 'running' ? 1 : 2 }}>
          {job.resource[0]}{index + 1}
          {job.status === 'running' && <i style={{ width: (4 - job.remaining) / 3 * 100 + '%' }} />}
        </span>)}
      </div>
    </div>
    <p className="rd-legend"><span><b>O</b> Orders</span><span><b data-kind="Invoices">I</b> Invoices</span><span>Dashed boxes are available slots</span></p>
    <p className="rd-status" aria-live="polite">
      <strong>{running.length}/{capacity} slots in use</strong> · {waiting.length} waiting · {finished.length} finished
      {separate && <span className="rd-visually-hidden">. Orders: {running.filter(job => job.resource === 'Orders').length}/{limit}. Invoices: {running.filter(job => job.resource === 'Invoices').length}/{limit}.</span>}
    </p>
    <details open={keys || undefined}>
      <summary>Change key or limit</summary>
      <div className="rd-controls">
        <select aria-label="Key grouping" value={separate ? 'separate' : 'shared'} onChange={event => reset(event.target.value === 'separate', limit)}>
          <option value="shared">Shared key</option><option value="separate">Separate keys</option>
        </select>
        <label>Limit per key <select value={limit} onChange={event => reset(separate, Number(event.target.value))}>{[1, 2, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <button type="button" onClick={() => reset(separate, limit)}>Reset</button>
      </div>
    </details>
    <p className="rd-footnote">Illustration of ordinary admission. A waiting Job has no slot and has not failed. The example steps do not specify timing or execution order.</p>
  </section>;
};

export const IdempotencyDemo = () => {
  const [strategy, setStrategy] = useState('stable');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const operations = strategy === 'expiry' ? ['invoice-1', 'invoice-1', null, 'invoice-1'] : ['invoice-1', 'invoice-1', 'invoice-2'];
  const initial = { keys: [], attempts: [] };
  const frames = operations.reduce((items, operation) => {
    const previous = items.at(-1) || initial;
    items.push(operation ? attemptKey(previous, operation, strategy) : { ...previous, keys: [] });
    return items;
  }, []);
  const current = step ? frames[step - 1] : initial;
  const latest = current.attempts.at(-1);
  const done = step === operations.length;
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => setStep(value => Math.min(value + 1, operations.length)), [operations.length]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (done) stop(); }, [done, stop]);

  return <section className="revo-demo not-prose" aria-label="Explore idempotency keys">
    <PlaygroundStyle />
    <h3>Recognize a repeated operation</h3>
    <div className="rd-toolbar">
      <select aria-label="Key strategy" value={strategy} onChange={event => { stop(); setStrategy(event.target.value); setStep(0); }}>
        <option value="stable">Stable business key</option>
        <option value="random">New key each time</option>
        <option value="global">One global key</option>
        <option value="expiry">Stable key expires</option>
      </select>
      <div className="rd-controls">
        <button type="button" className="rd-primary rd-playback" aria-pressed={playing} onClick={() => { if (done) setStep(0); setPlaying(!playing); }}>{playing ? 'Pause' : done ? 'Replay' : 'Play'}</button>
        <button type="button" disabled={done} onClick={() => { stop(); advance(); }}>Next step</button>
      </div>
    </div>
    <ol className="rd-rows" aria-label="Requests, keys and admission outcomes">
      {operations.map((operation, index) => {
        const attempt = frames[index].attempts.at(-1);
        const outcome = !operation ? 'Expired' : attempt.admitted ? 'Acquired' : 'Duplicate';
        return <li className="rd-row" key={index} aria-current={step === index + 1 ? 'step' : undefined} data-state={step <= index ? 'future' : 'seen'}>
          <strong>{operation === 'invoice-1' && index ? index === 3 ? 'After expiry' : 'Retry invoice 1' : operation || 'TTL expiry'}</strong>
          <code>{operation ? attempt.key : 'Clear active key'}</code>
          <span data-tone={outcome === 'Duplicate' ? 'warning' : undefined}>{outcome}</span>
        </li>;
      })}
    </ol>
    <p className="rd-status" aria-live="polite">
      <strong>{current.keys.length} active {current.keys.length === 1 ? 'key' : 'keys'}</strong> · {step}/{operations.length} steps
      {step > 0 && <span className="rd-visually-hidden">. {operations[step - 1] ? latest.admitted ? 'Key acquired' : 'Duplicate refused' : 'Key expired'}.</span>}
    </p>
    <p className="rd-footnote">Acquiring a key is not proof of a completed effect. TTL expiry allows admission again; it does not undo a previous effect. No invoice is issued.</p>
    <details><summary>Reset playback</summary><button type="button" onClick={() => { stop(); setStep(0); }}>Reset</button></details>
  </section>;
};

export const routeExample = (region, amount, source, mode = 'and') => {
  const rules = [
    { field: 'message.order.region', op: 'eq', value: 'eu', actual: region, matches: region === 'eu' },
    { field: 'message.order.total', op: 'gte', value: 10000, actual: amount, matches: typeof amount === 'number' && amount >= 10000 },
    { field: 'metadata.source', op: 'eq', value: 'checkout', actual: source, matches: source === 'checkout' },
  ];
  return { rules, matches: mode === 'and' ? rules.every(rule => rule.matches) : rules.some(rule => rule.matches) };
};

export const dispatchExample = (state, action) => {
  if (action === 'redeliver' && !state.occurrences.length) return state;
  if (action === 'replay' && !state.occurrences.length) return state;
  if (action === 'accept' && state.occurrences.length) return state;
  const next = { ...state, deliveries: state.deliveries + 1 };
  if (action === 'redeliver') return { ...next, note: 'Same accepted occurrence: reuse the two recorded child Jobs. No new initial Jobs.' };
  const number = state.occurrences.length + 1;
  const occurrence = 'event-' + number;
  return { ...next, occurrences: [...state.occurrences, occurrence],
    jobs: [...state.jobs, ...['billing', 'audit'].map(definition => ({ id: 'job-' + number + '-' + definition, occurrence, definition }))],
    note: action === 'replay' ? 'Replay creates a new occurrence. Both currently matching definitions create new Jobs; the business operation is still order-1.' : 'One accepted occurrence matches two definitions. Each definition owns its own child Job.' };
};

export const webhookAttempt = (state, outcome, protectedReceiver, maxRetries, stop401) => {
  if (state.terminal) return state;
  const attempts = state.attempts + 1;
  const received = outcome !== 'unauthenticated';
  const effects = state.effects + (received && (!protectedReceiver || state.effects === 0) ? 1 : 0);
  const status = outcome === 'success' ? 'FINISHED' : attempts >= maxRetries + 1 || (outcome === 'unauthenticated' && stop401) ? 'ERROR' : 'PENDING';
  return { attempts, effects, status, terminal: status !== 'PENDING',
    log: [...state.log, { attempt: attempts, outcome, effects,
      text: outcome === 'success' ? 'Receiver returned 2xx. Delivery is finished.' : outcome === 'unauthenticated' ? 'Receiver returned 401. This example performs no business mutation.' : 'Receiver committed, but its response was lost. RevoEngine cannot infer that effect from the timeout.' }] };
};

export const FilterDemo = () => {
  const presets = {
    matching: { region: 'eu', amount: '12500', source: 'checkout' },
    wrongRegion: { region: 'us', amount: '12500', source: 'checkout' },
    wrongType: { region: 'eu', amount: 'string', source: 'checkout' },
    wrongSource: { region: 'eu', amount: '12500', source: 'import' },
  };
  const [input, setInput] = useState(presets.matching);
  const [mode, setMode] = useState('and');
  const { region, amount, source } = input;
  const scenario = Object.keys(presets).find(key => Object.keys(input).every(field => input[field] === presets[key][field])) || 'custom';
  const actualAmount = amount === 'string' ? '12500' : Number(amount);
  const result = routeExample(region, actualAmount, source, mode);
  const setField = (field, value) => setInput(previous => ({ ...previous, [field]: value }));

  return <section className="revo-demo not-prose" aria-label="Explore Event filters">
    <PlaygroundStyle />
    <h3>From Event values to a routing decision</h3>
    <div className="rd-toolbar">
      <select aria-label="Event input" value={scenario} onChange={event => setInput(presets[event.target.value])}>
        <option value="matching">Matching input</option>
        <option value="wrongRegion">Other region</option>
        <option value="wrongType">Total is a string</option>
        <option value="wrongSource">Other metadata source</option>
        <option value="custom" disabled>Custom values</option>
      </select>
      <select aria-label="Condition group" value={mode} onChange={event => setMode(event.target.value)}>
        <option value="and">All conditions</option><option value="or">Any condition</option>
      </select>
    </div>
    <ol className="rd-rows" aria-label="Input, predicate and match">
      {result.rules.map(rule => <li className="rd-row" key={rule.field} data-tone={rule.matches ? undefined : 'warning'}>
        <code>{JSON.stringify(rule.actual)}</code>
        <code>{rule.field + ' ' + rule.op + ' ' + JSON.stringify(rule.value)}</code>
        <span>{rule.matches ? 'Matches' : 'No match'}</span>
      </li>)}
    </ol>
    <p className="rd-status" aria-live="polite"><strong>{result.matches ? 'Target eligible' : 'No dispatch to this target'}</strong> · {result.rules.filter(rule => rule.matches).length}/3 conditions match</p>
    <details>
      <summary>Change individual values or inspect JSON</summary>
      <div className="rd-controls">
        <label>Region <select value={region} onChange={event => setField('region', event.target.value)}><option value="eu">eu</option><option value="us">us</option></select></label>
        <label>Total <select value={amount} onChange={event => setField('amount', event.target.value)}><option value="12500">12500 · number</option><option value="500">500 · number</option><option value="string">"12500" · string</option></select></label>
        <label>Metadata source <select value={source} onChange={event => setField('source', event.target.value)}><option value="checkout">checkout</option><option value="import">import</option></select></label>
        <button type="button" onClick={() => { setInput(presets.matching); setMode('and'); }}>Reset</button>
      </div>
      <code className="rd-result">{JSON.stringify({ [mode]: result.rules.map(({ field, op, value }) => ({ field, op, value })) }, null, 2)}</code>
    </details>
    <p className="rd-footnote">Platform API filter example. A numeric string does not satisfy numeric ordering. The visual editor uses message-relative paths and does not express this top-level metadata condition.</p>
  </section>;
};

export const DeliveryDemo = () => {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const initial = { occurrences: [], jobs: [], deliveries: 0 };
  const actions = ['accept', 'redeliver', 'replay'];
  const labels = ['Accept Event', 'Redeliver', 'Operator Replay'];
  const frames = actions.reduce((items, action) => {
    items.push(dispatchExample(items.at(-1) || initial, action));
    return items;
  }, []);
  const state = step ? frames[step - 1] : initial;
  const done = step === actions.length;
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => setStep(value => Math.min(value + 1, actions.length)), [actions.length]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (done) stop(); }, [done, stop]);

  return <section className="revo-demo not-prose" aria-label="Explore Event delivery and replay">
    <PlaygroundStyle />
    <h3>One business key, two dispatch paths</h3>
    <div className="rd-toolbar">
      <code>order-1:invoice:v1</code>
      <div className="rd-controls">
        <button type="button" className="rd-primary rd-playback" aria-pressed={playing} onClick={() => { if (done) setStep(0); setPlaying(!playing); }}>{playing ? 'Pause' : done ? 'Replay animation' : 'Play'}</button>
        <button type="button" disabled={done} onClick={() => { stop(); advance(); }}>Next step</button>
      </div>
    </div>
    <ol className="rd-rows" aria-label="Operation, occurrence and child Jobs">
      {frames.map((frame, index) => <li className="rd-row" key={actions[index]} aria-current={step === index + 1 ? 'step' : undefined} data-state={step <= index ? 'future' : 'seen'}>
        <strong>{labels[index]}</strong>
        <code>{frame.occurrences.at(-1)} → Billing + Audit</code>
        <span>{index === 1 ? 'Reuse 2' : '+2 Jobs'}</span>
      </li>)}
    </ol>
    <p className="rd-status" aria-live="polite"><strong>{state.occurrences.length} {state.occurrences.length === 1 ? 'occurrence' : 'occurrences'} · {state.jobs.length} Jobs</strong>{state.note ? ' · ' + state.note : ''}</p>
    <p className="rd-footnote">Replay evaluates current definitions and filters. This example fixes two matching definitions. Initial dispatch and later attempts are separate from the business outcome.</p>
    <details><summary>Reset playback</summary><button type="button" onClick={() => { stop(); setStep(0); }}>Reset</button></details>
  </section>;
};

export const WebhookDemo = () => {
  const [scenario, setScenario] = useState('lostThenSuccess');
  const [protectedReceiver, setProtected] = useState(true);
  const [retries, setRetries] = useState(1);
  const [stop401, setStop401] = useState(true);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const initial = { attempts: 0, effects: 0, status: 'PENDING', terminal: false, log: [] };
  const sequence = scenario === 'lostAlways' ? Array(retries + 1).fill('lost') : [scenario === 'unauthenticated' ? 'unauthenticated' : 'lost', 'success'];
  const outcomeLabels = { lost: 'Commit, response lost', success: 'HTTP 2xx', unauthenticated: 'HTTP 401' };
  const frames = sequence.reduce((items, outcome) => {
    const previous = items.at(-1) || initial;
    if (!previous.terminal) items.push(webhookAttempt(previous, outcome, protectedReceiver, retries, stop401));
    return items;
  }, []);
  const state = step ? frames[step - 1] : initial;
  const done = step === frames.length;
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => setStep(value => Math.min(value + 1, frames.length)), [frames.length]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (done) stop(); }, [done, stop]);
  const reset = () => { stop(); setStep(0); };

  return <section className="revo-demo not-prose" aria-label="Explore webhook attempts">
    <PlaygroundStyle />
    <h3>One Webhook, separate attempts and effects</h3>
    <div className="rd-toolbar">
      <select aria-label="Delivery scenario" value={scenario} onChange={event => { reset(); setScenario(event.target.value); }}>
        <option value="lostThenSuccess">Lost response, then 2xx</option>
        <option value="lostAlways">Lose every response</option>
        <option value="unauthenticated">Receiver rejects with 401</option>
      </select>
      <div className="rd-controls">
        <button type="button" className="rd-primary rd-playback" aria-pressed={playing} onClick={() => { if (done) setStep(0); setPlaying(!playing); }}>{playing ? 'Pause' : done ? 'Replay' : 'Play'}</button>
        <button type="button" disabled={done} onClick={() => { stop(); advance(); }}>Next step</button>
      </div>
    </div>
    <p className="rd-legend"><span><code>order-1:ready:v1</code></span><span>{protectedReceiver ? 'Receiver deduplicates' : 'Receiver applies every request'}</span></p>
    <ol className="rd-rows" aria-label="HTTP attempt, receiver outcome and cumulative effects">
      {frames.map((frame, index) => <li className="rd-row" key={index} aria-current={step === index + 1 ? 'step' : undefined} data-state={step <= index ? 'future' : 'seen'}>
        <strong>Attempt {index + 1}</strong>
        <code data-tone={frame.status === 'ERROR' ? 'error' : undefined}>{outcomeLabels[frame.log.at(-1).outcome]}</code>
        <span>{frame.effects} {frame.effects === 1 ? 'effect' : 'effects'}</span>
      </li>)}
    </ol>
    <p className="rd-status" aria-live="polite"><strong>{state.status}</strong> · {state.attempts} HTTP {state.attempts === 1 ? 'attempt' : 'attempts'} · {state.effects} business {state.effects === 1 ? 'effect' : 'effects'}</p>
    <details>
      <summary>Receiver and retry settings</summary>
      <div className="rd-controls">
        <label>Receiver <select value={protectedReceiver ? 'safe' : 'unsafe'} onChange={event => { reset(); setProtected(event.target.value === 'safe'); }}><option value="safe">Deduplicates business key</option><option value="unsafe">Applies every request</option></select></label>
        <label>maxRetries <select value={retries} onChange={event => { reset(); setRetries(Number(event.target.value)); }}>{[0, 1, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><input type="checkbox" checked={stop401} onChange={event => { reset(); setStop401(event.target.checked); }} />Stop on 401</label>
        <button type="button" onClick={reset}>Reset</button>
      </div>
    </details>
    <p className="rd-footnote">Synthetic receiver. A stable key works when the receiver enforces it. Send it explicitly in the HTTP request. FINISHED confirms HTTP delivery. A lost response can hide a committed effect.</p>
  </section>;
};
