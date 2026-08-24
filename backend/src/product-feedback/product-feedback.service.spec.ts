import { BadRequestException } from '@nestjs/common';
import { ProductFeedbackService } from './product-feedback.service';

describe('ProductFeedbackService', () => {
  function setup() {
    const dataSource = {
      query: jest.fn(async (sql: string) =>
        sql.includes('INSERT INTO product_feedback_requests')
          ? [{ id: 'feedback-1', status: 'NEW', createdAt: new Date() }]
          : [],
      ),
      transaction: jest.fn(),
    };
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'pessoa@example.com',
        displayName: 'Pessoa',
        type: 'CANDIDATE',
        companyId: null,
      }),
    };
    const ai = { analyzeProductFeedback: jest.fn(), supportChatReply: jest.fn() };
    const notifications = { notifyUser: jest.fn() };
    return {
      dataSource,
      service: new ProductFeedbackService(
        dataSource as never,
        users as never,
        ai as never,
        notifications as never,
      ),
    };
  }

  it('registra a página e o processo junto da sugestão', async () => {
    const { service, dataSource } = setup();

    await expect(
      service.submit('user-1', {
        message: 'Queria filtrar os convites por status.',
        pagePath: '/company/vagas/convites?jobId=1',
        process: 'Convites para vagas',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'feedback-1' }));

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO product_feedback_requests'),
      expect.arrayContaining([
        '/company/vagas/convites?jobId=1',
        'Convites para vagas',
        'Queria filtrar os convites por status.',
      ]),
    );
  });

  it('rejeita captura maior que 2 MB', async () => {
    const { service } = setup();

    await expect(
      service.submit('user-1', {
        message: 'Algo não funcionou.',
        screenshot: {
          name: 'erro.png',
          mimeType: 'image/png',
          size: 2 * 1024 * 1024 + 1,
          data: 'data:image/png;base64,abc',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
