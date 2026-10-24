# P4: workflow

Start with docs/handoffs/P4-WORKFLOW-ADVOCATE.md. The app injects MarketRepository and LogisticsService into createWorkflowService. The current generation runs the module stubs and returns an explicitly incomplete empty result. Implement plan repository, quote assembly, bounded orchestration and safe decisions here. Do not make HTTP calls to modules inside the same process. The starter propagates a deadline signal; enforcing a hard overall timeout and returning partial evaluated results remains P4 work.
