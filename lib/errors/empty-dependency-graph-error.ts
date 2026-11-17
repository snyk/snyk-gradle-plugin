// Thrown when a project's dependency graph is empty because resolving one or
// more of its configurations failed. Reporting "no dependencies" there would
// look like a clean scan, so the plugin fails loudly instead.
export class EmptyDependencyGraphError extends Error {
  public name = 'EmptyDependencyGraphError';
  public project: string;
  public failures: string[];

  constructor(project: string, failures: string[]) {
    const shown = failures.slice(0, 5).join('\n  ');
    const more =
      failures.length > 5 ? `\n  ...and ${failures.length - 5} more` : '';
    super(
      `Gradle project "${project}" returned no dependencies because ` +
        `${failures.length} configuration(s) failed to resolve:\n  ` +
        `${shown}${more}\n` +
        'Run with --debug for details. Common causes are dependency ' +
        'verification failures and unresolvable repositories.',
    );
    this.project = project;
    this.failures = failures;
    Error.captureStackTrace(this, EmptyDependencyGraphError);
  }
}
