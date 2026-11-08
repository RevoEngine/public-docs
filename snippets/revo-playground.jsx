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
  .revo-demo { --rd-border: #d4d4d8; --rd-muted: #52525b; --rd-panel: #fafafa; --rd-accent: #0f766e; color: #18181b; border: 1px solid var(--rd-border); border-radius: 18px; margin: 1.5rem 0 2rem; padding: 22px; background: #fff; font-size: 14px; line-height: 1.55; overflow: hidden; }
  .dark .revo-demo { --rd-border: #52525b; --rd-muted: #d4d4d8; --rd-panel: #27272a; --rd-accent: #5eead4; color: #fafafa; background: #18181b; }
  .revo-demo * { box-sizing: border-box; }
  .revo-demo .rd-eyebrow { color: var(--rd-accent); font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
  .revo-demo h3 { color: inherit; margin: 5px 0 7px; font-size: 21px; line-height: 1.25; font-weight: 650; }
  .revo-demo p { margin: 8px 0; }
  .revo-demo .rd-muted { color: var(--rd-muted); }
  .revo-demo .rd-controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; align-items: center; }
  .revo-demo button, .revo-demo select { font: inherit; color: inherit; background: var(--rd-panel); border: 1px solid var(--rd-border); border-radius: 8px; padding: 7px 11px; cursor: pointer; min-height: 38px; }
  .revo-demo button:hover:not(:disabled) { border-color: var(--rd-accent); }
  .revo-demo button:focus-visible, .revo-demo select:focus-visible, .revo-demo input:focus-visible { outline: 3px solid var(--rd-accent); outline-offset: 3px; }
  .revo-demo button[aria-pressed="true"], .revo-demo .rd-primary { background: #0f766e; border-color: #0f766e; color: #fff; }
  .revo-demo button:disabled { opacity: .48; cursor: default; }
  .revo-demo label { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
  .revo-demo .rd-track { display: grid; grid-template-columns: repeat(auto-fit,minmax(90px,1fr)); gap: 7px; padding: 0; margin: 18px 0; list-style: none; }
  .revo-demo .rd-node { min-height: 78px; padding: 11px 8px; border: 1px solid var(--rd-border); border-radius: 10px; font-size: 12px; overflow-wrap: anywhere; }
  .revo-demo .rd-node b { display: block; font-size: 11px; margin-bottom: 7px; color: var(--rd-muted); }
  .revo-demo .rd-node[aria-current="step"] { border-color: var(--rd-accent); box-shadow: inset 0 3px 0 var(--rd-accent); background: var(--rd-panel); animation: rd-arrive .3s ease-out; }
  .revo-demo .rd-detail { padding: 16px; border-radius: 12px; border: 1px solid var(--rd-border); background: var(--rd-panel); min-height: 155px; }
  .revo-demo .rd-result { display: block; margin: 14px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.6 ui-monospace,monospace; padding: 11px; border-left: 3px solid var(--rd-accent); }
  .revo-demo .rd-error { border-left-color: #dc2626; }
  .revo-demo .rd-warning { border-left-color: #d97706; }
  .revo-demo .rd-meters { display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 0; font-variant-numeric: tabular-nums; }
  .revo-demo .rd-board { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 9px; margin: 16px 0; }
  .revo-demo .rd-lane { padding: 10px; border: 1px solid var(--rd-border); border-radius: 12px; min-height: 190px; background: var(--rd-panel); }
  .revo-demo .rd-lane strong { display: block; font-size: 12px; margin-bottom: 10px; }
  .revo-demo .rd-job { margin: 8px 0; padding: 9px; border: 1px solid var(--rd-border); border-radius: 8px; background: inherit; overflow-wrap: anywhere; font-size: 12px; animation: rd-arrive .3s ease-out; }
  .revo-demo .rd-job small { display: block; color: var(--rd-muted); font-size: 10px; }
  .revo-demo .rd-progress { height: 4px; background: var(--rd-border); border-radius: 3px; overflow: hidden; margin-top: 9px; }
  .revo-demo .rd-progress span { display: block; height: 100%; background: var(--rd-accent); transition: width .5s ease; }
  .revo-demo .rd-attempts { list-style: none; padding: 0; margin: 12px 0; max-height: 290px; overflow: auto; }
  .revo-demo .rd-attempt { display: grid; grid-template-columns: 1fr auto; gap: 8px; border-top: 1px solid var(--rd-border); padding: 10px 0; animation: rd-arrive .3s ease-out; }
  .revo-demo .rd-attempt code { display: block; font: 11px/1.6 ui-monospace,monospace; overflow-wrap: anywhere; }
  .revo-demo .rd-badge { font-size: 11px; font-weight: 650; }
  .revo-demo .rd-footnote { font-size: 12px; color: var(--rd-muted); border-top: 1px solid var(--rd-border); padding-top: 12px; margin-top: 15px; }
  @keyframes rd-arrive { from { opacity: .3; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 480px) { .revo-demo { padding: 14px; } .revo-demo .rd-board { grid-template-columns: 1fr; } .revo-demo .rd-lane { min-height: 64px; } .revo-demo .rd-track { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media (prefers-reduced-motion: reduce) { .revo-demo * { animation: none !important; transition: none !important; } }
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
    motion.addEventListener('change', reduce);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', reduce); };
  }, [playing, advance, stop]);
};

export const FlowDemo = ({ topic }) => {
  const flow = flowCatalog[topic];
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const steps = flow.cases[selected].steps;
  const current = steps[step];
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => setStep(value => Math.min(value + 1, steps.length - 1)), [steps.length]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (step === steps.length - 1) setPlaying(false); }, [step, steps.length]);
  return <section className="revo-demo not-prose" aria-label={flow.title}>
    <PlaygroundStyle />
    <div className="rd-eyebrow">Interactive walkthrough</div><h3>{flow.title}</h3><p className="rd-muted">{flow.intro}</p>
    <div className="rd-controls" aria-label="Choose a scenario">{flow.cases.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index} onClick={() => { setSelected(index); setStep(0); stop(); }}>{item.name}</button>)}</div>
    <ol className="rd-track">{steps.map((item, index) => <li key={index} className="rd-node" aria-current={index === step ? 'step' : undefined}><b>{index + 1}</b>{item[0]}</li>)}</ol>
    <div className="rd-detail" aria-live="polite" aria-atomic="true"><strong>{step + 1}. {current[0]}</strong><p>{current[1]}</p><code className={'rd-result rd-' + (current[3] || 'normal')}>{current[2]}</code></div>
    <div className="rd-controls"><button type="button" disabled={step === 0} onClick={() => { stop(); setStep(step - 1); }}>Back</button><button type="button" className="rd-primary" disabled={step === steps.length - 1} onClick={() => { stop(); advance(); }}>Next step</button><button type="button" disabled={step === steps.length - 1} aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button><button type="button" onClick={() => { stop(); setStep(0); }}>Reset</button><span className="rd-muted">{step + 1} / {steps.length}</span></div>
    <p className="rd-footnote">Illustrative local simulation. No request is sent to a RevoEngine instance. Steps show contract boundaries, not measured timing. With reduced motion, use Next step.</p>
  </section>;
};

export const ConcurrencyDemo = ({ keys = false }) => {
  const [separate, setSeparate] = useState(false);
  const [limit, setLimit] = useState(2);
  const [jobs, setJobs] = useState(() => makeQueue(false));
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const done = jobs.every(job => job.status === 'finished');
  const stop = useCallback(() => setPlaying(false), []);
  const advance = useCallback(() => { setJobs(value => advanceQueue(value, limit)); setTick(value => value + 1); }, [limit]);
  useDemoPlayback(playing, advance, stop);
  useEffect(() => { if (done) stop(); }, [done, stop]);
  const reset = (nextSeparate, nextLimit) => { stop(); setSeparate(nextSeparate); setLimit(nextLimit); setJobs(makeQueue(nextSeparate)); setTick(0); };
  const running = jobs.filter(job => job.status === 'running').length;
  return <section className="revo-demo not-prose" aria-label={keys ? 'Compare coordination keys' : 'Explore Job concurrency'}>
    <PlaygroundStyle /><div className="rd-eyebrow">Interactive simulation</div><h3>{keys ? 'Same key, shared capacity' : 'Let six Jobs compete for slots'}</h3><p className="rd-muted">Two templates: Orders and Invoices. Change the limit or split their configured keys, then advance the queue.</p>
    <div className="rd-controls"><label>Limit per key <select aria-label="Limit per key" value={limit} onChange={event => reset(separate, Number(event.target.value))}>{[1, 2, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" aria-pressed={!separate} onClick={() => reset(false, limit)}>Shared key</button><button type="button" aria-pressed={separate} onClick={() => reset(true, limit)}>Separate keys</button></div>
    <code className="rd-result">{separate ? 'Orders → import_orders\nInvoices → import_invoices' : 'Orders + Invoices → shared_import'}{'\nlimit: ' + limit + ' per key'}</code>
    <div className="rd-meters" aria-live="polite"><span><strong>{running}</strong> running</span><span><strong>{jobs.filter(job => job.status === 'waiting').length}</strong> waiting</span><span><strong>{jobs.filter(job => job.status === 'finished').length}</strong> finished</span></div>
    <div className="rd-board">{[['waiting', 'Waiting'], ['running', 'Running'], ['finished', 'Finished']].map(([status, label]) => <div className="rd-lane" key={status}><strong>{label}</strong>{jobs.filter(job => job.status === status).map(job => <div className="rd-job" key={job.id}>{job.id} · {job.resource}<small>{job.key}</small>{status === 'running' && <div className="rd-progress" aria-hidden="true"><span style={{ width: (4 - job.remaining) / 3 * 100 + '%' }} /></div>}</div>)}</div>)}</div>
    <div className="rd-controls"><button type="button" className="rd-primary" disabled={done} onClick={() => { stop(); advance(); }}>Next step</button><button type="button" disabled={done} aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button><button type="button" onClick={() => reset(separate, limit)}>Reset</button><span className="rd-muted">{done ? 'All Jobs finished' : 'Simulation step ' + tick}</span></div>
    <p>{separate ? 'Different keys allow independent capacity. Both templates can run up to the limit, so total load can be twice as high.' : 'The shared key puts both templates in the same capacity bucket. Together they cannot exceed its configured limit in this example.'}</p>
    <p className="rd-footnote">Local simulation of ordinary admission; no real Jobs run. Waiting here is not an ERROR. Keys are literal template settings, not expressions from Event payloads. Steps are not seconds; order and duration are illustrative, not a fairness guarantee. Force-run and configured retry bypass are outside this example. Use Next step with reduced motion.</p>
  </section>;
};

export const IdempotencyDemo = () => {
  const [strategy, setStrategy] = useState('stable');
  const [state, setState] = useState({ keys: [], attempts: [] });
  const reset = value => { setStrategy(value); setState({ keys: [], attempts: [] }); };
  const attempt = operation => setState(value => attemptKey(value, operation, strategy));
  const latest = state.attempts[state.attempts.length - 1];
  return <section className="revo-demo not-prose" aria-label="Explore idempotency keys">
    <PlaygroundStyle /><div className="rd-eyebrow">Interactive simulation</div><h3>Recognize the same business operation</h3><p className="rd-muted">Acquire an admission key, repeat the request, then try a different invoice. No invoice is actually issued.</p>
    <div className="rd-controls"><label>Key strategy <select aria-label="Key strategy" value={strategy} onChange={event => reset(event.target.value)}><option value="stable">Stable business key</option><option value="random">New key on every request</option><option value="global">One key for all invoices</option></select></label></div>
    <div className="rd-controls"><button type="button" className="rd-primary" disabled={state.attempts.length >= 12} onClick={() => attempt('invoice-1')}>Request invoice 1 again</button><button type="button" disabled={state.attempts.length >= 12} onClick={() => attempt('invoice-2')}>Request invoice 2</button><button type="button" disabled={!state.keys.length} onClick={() => setState(value => ({ ...value, keys: [] }))}>Simulate TTL expiry</button><button type="button" onClick={() => reset(strategy)}>Reset</button></div>
    <div className="rd-detail" aria-live="polite" aria-atomic="true"><strong>{!state.keys.length && state.attempts.length ? 'No active keys remain' : latest ? (latest.admitted ? 'Admission acquired' : 'Duplicate admission refused') : 'Ready for the first request'}</strong><p>{strategy === 'random' ? 'A new request key makes every retry look like new work. It does not protect the business operation.' : strategy === 'global' ? 'A global key can block unrelated invoices. The key is too broad for this operation.' : 'The same invoice and operation version reuse one key. A different invoice can be admitted independently.'}</p><code className="rd-result">{latest ? 'Last attempt: ' + latest.key + '\nacquireIdempotencyKey → ' + latest.admitted + '\nActive keys now: ' + state.keys.length : 'Choose a request above.'}</code></div>
    <ol className="rd-attempts">{state.attempts.map(item => <li className="rd-attempt" key={item.number}><div>#{item.number} · {item.operation}<code>{item.key}</code></div><span className="rd-badge">{item.admitted ? 'ACQUIRED' : 'DUPLICATE'}</span></li>)}</ol>
    {state.attempts.length >= 12 && <p>Reset to start another sequence.</p>}
    <p className="rd-footnote">Local admission simulation only. Acquiring a key is not proof of a completed effect and is not atomic with a separate HTTP call or database write. TTL expiry allows admission again; it does not undo a previous effect. Retain business evidence and reconcile uncertain outcomes. Do not release a key blindly after an error.</p>
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
  const [region, setRegion] = useState('eu');
  const [amount, setAmount] = useState('12500');
  const [source, setSource] = useState('checkout');
  const [mode, setMode] = useState('and');
  const actualAmount = amount === 'string' ? '12500' : Number(amount);
  const result = routeExample(region, actualAmount, source, mode);
  const reset = () => { setRegion('eu'); setAmount('12500'); setSource('checkout'); setMode('and'); };
  return <section className="revo-demo not-prose" aria-label="Explore Event filters">
    <PlaygroundStyle /><div className="rd-eyebrow">Interactive filter</div><h3>Will this Event reach the target?</h3><p className="rd-muted">Change the message and occurrence metadata. This example uses the Platform API filter syntax.</p>
    <div className="rd-controls"><label>Region <select value={region} onChange={event => setRegion(event.target.value)}><option value="eu">eu</option><option value="us">us</option></select></label><label>Total <select value={amount} onChange={event => setAmount(event.target.value)}><option value="12500">12500 · number</option><option value="500">500 · number</option><option value="string">"12500" · string</option></select></label><label>Metadata source <select value={source} onChange={event => setSource(event.target.value)}><option value="checkout">checkout</option><option value="import">import</option></select></label><label>Match <select value={mode} onChange={event => setMode(event.target.value)}><option value="and">All conditions</option><option value="or">Any condition</option></select></label><button type="button" onClick={reset}>Reset</button></div>
    <ol className="rd-attempts">{result.rules.map(rule => <li className="rd-attempt" key={rule.field}><div><code>{rule.field + ' ' + rule.op + ' ' + JSON.stringify(rule.value)}</code><small>Actual: {JSON.stringify(rule.actual)}</small></div><span className="rd-badge">{rule.matches ? 'MATCH' : 'NO MATCH'}</span></li>)}</ol>
    <div className="rd-detail" aria-live="polite" aria-atomic="true"><strong>{result.matches ? 'Subscription matches' : 'No target from this subscription'}</strong><p>{result.matches ? 'The target is eligible for dispatch. Its Component must still validate the business data and authorization.' : 'The Event can still match another definition. This is a routing decision, not a failed Job.'}</p><code className="rd-result">{JSON.stringify({ [mode]: result.rules.map(({ field, op, value }) => ({ field, op, value })) }, null, 2)}</code></div>
    <p className="rd-footnote">Local example of eq, numeric gte, and/or only; not a complete filter engine. The visual editor accepts message-relative paths and cannot express this top-level metadata condition. A numeric string does not satisfy numeric ordering. No request is sent.</p>
  </section>;
};

export const DeliveryDemo = () => {
  const initial = { occurrences: [], jobs: [], deliveries: 0, note: 'Accept order-1 to start. Billing and Audit are two matching Event definitions.' };
  const [state, setState] = useState(initial);
  const send = action => setState(value => dispatchExample(value, action));
  return <section className="revo-demo not-prose" aria-label="Explore Event delivery and replay">
    <PlaygroundStyle /><div className="rd-eyebrow">Interactive dispatch</div><h3>Same delivery or new occurrence?</h3><p className="rd-muted">Two subscriptions handle one business operation: order-1. Job completion and external effects are separate.</p>
    <div className="rd-controls"><button type="button" className="rd-primary" disabled={state.occurrences.length > 0} onClick={() => send('accept')}>Accept Event</button><button type="button" disabled={!state.occurrences.length} onClick={() => send('redeliver')}>Redeliver same occurrence</button><button type="button" disabled={!state.occurrences.length || state.occurrences.length >= 4} onClick={() => send('replay')}>Operator Replay</button><button type="button" onClick={() => setState(initial)}>Reset</button></div>
    <div className="rd-meters"><span>Delivery observations <strong>{state.deliveries}</strong></span><span>Occurrences <strong>{state.occurrences.length}</strong></span><span>Initial Jobs <strong>{state.jobs.length}</strong></span></div>
    <div className="rd-detail" aria-live="polite" aria-atomic="true"><strong>{state.note}</strong><code className="rd-result">{'Business key stays: order-1:invoice:v1\nInitial child identity belongs to: occurrence + Event definition'}</code></div>
    <ol className="rd-attempts">{state.jobs.map(job => <li className="rd-attempt" key={job.id}><div><code>{job.id}</code><small>{job.occurrence} → {job.definition}</small></div><span className="rd-badge">CREATED</span></li>)}</ol>
    <p className="rd-footnote">Synthetic IDs and two fixed matching definitions. Replay evaluates current definitions and filters; changing them can change fan-out. The same target template used by two definitions still represents two subscriptions. Application retries create later attempts, outside this initial-dispatch counter. This is not an exactly-once business-effect guarantee.</p>
  </section>;
};

export const WebhookDemo = () => {
  const initial = { attempts: 0, effects: 0, status: 'PENDING', terminal: false, log: [] };
  const [state, setState] = useState(initial);
  const [protectedReceiver, setProtected] = useState(true);
  const [retries, setRetries] = useState(1);
  const [stop401, setStop401] = useState(true);
  const attempt = outcome => setState(value => webhookAttempt(value, outcome, protectedReceiver, retries, stop401));
  return <section className="revo-demo not-prose" aria-label="Explore webhook attempts">
    <PlaygroundStyle /><div className="rd-eyebrow">Interactive delivery</div><h3>One Webhook, several possible attempts</h3><p className="rd-muted">First try “Commit, lose response”, then “Deliver with 2xx”. Compare the number of HTTP attempts with the receiver's business effects.</p>
    <div className="rd-controls"><label>Receiver <select value={protectedReceiver ? 'safe' : 'unsafe'} onChange={event => { setProtected(event.target.value === 'safe'); setState(initial); }}><option value="safe">Stores business idempotency key</option><option value="unsafe">Applies every request</option></select></label><label>maxRetries <select value={retries} onChange={event => { setRetries(Number(event.target.value)); setState(initial); }}>{[0, 1, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><input type="checkbox" checked={stop401} onChange={event => { setStop401(event.target.checked); setState(initial); }} />Stop on 401</label></div>
    <div className="rd-controls"><button type="button" className="rd-primary" disabled={state.terminal} onClick={() => attempt('lost')}>Commit, lose response</button><button type="button" disabled={state.terminal} onClick={() => attempt('success')}>Deliver with 2xx</button><button type="button" disabled={state.terminal} onClick={() => attempt('unauthenticated')}>Return 401</button><button type="button" onClick={() => setState(initial)}>Reset</button></div>
    <div className="rd-meters"><span>Webhook records <strong>1</strong></span><span>HTTP attempts <strong>{state.attempts}</strong></span><span>Receiver effects <strong>{state.effects}</strong></span></div>
    <div className="rd-detail" aria-live="polite" aria-atomic="true"><strong>{state.status}</strong><p>{state.log.length ? state.log[state.log.length - 1].text : 'No request has been attempted.'}</p><code className="rd-result">{'Idempotency-Key: order-1:ready:v1\nMaximum outgoing attempts: ' + (retries + 1) + '\n' + (state.terminal ? 'Delivery stopped. A repeated dispatch does not issue another request.' : 'A further attempt is permitted by this example policy.')}</code></div>
    <ol className="rd-attempts">{state.log.map(item => <li className="rd-attempt" key={item.attempt}><div>Attempt {item.attempt}<code>{item.outcome}</code></div><span className="rd-badge">{item.effects} effect(s)</span></li>)}</ol>
    <p className="rd-footnote">Synthetic receiver, no HTTP requests. A stable key works only when the receiver enforces it and retains its result. Configure that key explicitly in request headers or body; Webhook metadata is not automatically sent. FINISHED confirms HTTP delivery, not a partner's later asynchronous business workflow. Backoff timing and manual retry are outside this simulation.</p>
  </section>;
};
