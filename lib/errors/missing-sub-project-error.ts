export class MissingSubProjectError extends Error {
  public name = 'MissingSubProjectError';
  public subProject: string;
  public allProjects: string;

  constructor(subProject, allProjects) {
    super (`Specified sub-project not found:"${subProject}". ` +
    `Found these projects: ${allProjects.join(', ')}`);
    this.subProject = subProject;
    this.allProjects = allProjects;
    Error.captureStackTrace(this, MissingSubProjectError);
  }
}
