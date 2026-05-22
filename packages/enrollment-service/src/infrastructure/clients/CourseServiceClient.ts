import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export class CourseServiceClient {
  private readonly http = createInternalClient(config.serviceCourseUrl, config.internalServiceKey);

  async isCoursePublished(courseId: string): Promise<boolean> {
    try {
      const res = await this.http.get<{ state: string; title: string }>(`/internal/courses/${courseId}/state`);
      return res.data.state === 'published';
    } catch {
      return false;
    }
  }

  async getCourseTitle(courseId: string): Promise<string | null> {
    try {
      const res = await this.http.get<{ state: string; title: string }>(`/internal/courses/${courseId}/state`);
      return res.data.title ?? null;
    } catch {
      return null;
    }
  }
}
