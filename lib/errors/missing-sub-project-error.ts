export class MissingSubProjectError extends Error {
  public name = 'MissingSubProjectError';
  public targetProject: string;
  public allProjects: string[];

  constructor(subProject: string, allSubProjectNames: string[]) {
    const msg = !allSubProjectNames.length
      ? 'No projects found.'
      : `Found these projects: ${allSubProjectNames}`;
    super(`Specified sub-project not found: "${subProject}". ` + msg);
    this.subProject = subProject;
    this.allProjects = allSubProjectNames;
    Error.captureStackTrace(this, MissingSubProjectError);
  }
}
