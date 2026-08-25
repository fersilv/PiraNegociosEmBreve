export const WPP_OPERATION_CAPABILITIES = [
  // Blocklist
  { scope: 'wpp:getBlockList', method: 'getBlockList', category: 'Contatos · Bloqueios', label: 'Listar bloqueados', description: 'Retorna os contatos bloqueados pela conta.', risk: 'read', signature: 'getBlockList()' },
  { scope: 'wpp:blockContact', method: 'blockContact', category: 'Contatos · Bloqueios', label: 'Bloquear contato', description: 'Bloqueia um contato no WhatsApp.', risk: 'destructive', signature: 'blockContact(contactId)' },
  { scope: 'wpp:unblockContact', method: 'unblockContact', category: 'Contatos · Bloqueios', label: 'Desbloquear contato', description: 'Remove um contato da lista de bloqueados.', risk: 'write', signature: 'unblockContact(contactId)' },

  // Chat read
  { scope: 'wpp:listChats', method: 'listChats', category: 'Conversas · Consulta', label: 'Listar chats', description: 'Lista chats com filtros modernos do WPPConnect.', risk: 'read', signature: 'listChats(options?)' },
  { scope: 'wpp:getChatById', method: 'getChatById', category: 'Conversas · Consulta', label: 'Consultar chat por ID', description: 'Obtém os dados de um chat específico.', risk: 'read', signature: 'getChatById(chatId)' },
  { scope: 'wpp:getMessages', method: 'getMessages', category: 'Conversas · Consulta', label: 'Buscar histórico', description: 'Busca mensagens diretamente no WhatsApp com count, id, direction e filtros de mídia.', risk: 'read', signature: 'getMessages(chatId, params?)' },
  { scope: 'wpp:getMessageById', method: 'getMessageById', category: 'Conversas · Consulta', label: 'Consultar mensagem por ID', description: 'Obtém uma mensagem específica usando o ID do WhatsApp.', risk: 'read', signature: 'getMessageById(messageId)' },
  { scope: 'wpp:getAllUnreadMessages', method: 'getAllUnreadMessages', category: 'Conversas · Consulta', label: 'Mensagens não lidas', description: 'Lista mensagens não lidas disponíveis na sessão.', risk: 'read', signature: 'getAllUnreadMessages()' },
  { scope: 'wpp:getReactions', method: 'getReactions', category: 'Conversas · Consulta', label: 'Consultar reações', description: 'Consulta reações e autores de reações de uma mensagem.', risk: 'read', signature: 'getReactions(messageId)' },
  { scope: 'wpp:getVotes', method: 'getVotes', category: 'Conversas · Consulta', label: 'Consultar votos de enquete', description: 'Consulta os votos registrados em uma enquete.', risk: 'read', signature: 'getVotes(messageId)' },
  { scope: 'wpp:getPlatformFromMessage', method: 'getPlatformFromMessage', category: 'Conversas · Consulta', label: 'Identificar plataforma', description: 'Identifica a plataforma/origem associada a uma mensagem quando disponível.', risk: 'read', signature: 'getPlatformFromMessage(messageId)' },
  { scope: 'wpp:getListMutes', method: 'getListMutes', category: 'Conversas · Consulta', label: 'Listar silenciamentos', description: 'Consulta chats atualmente silenciados.', risk: 'read', signature: 'getListMutes()' },

  // Chat controls
  { scope: 'wpp:archiveChat', method: 'archiveChat', category: 'Conversas · Gestão', label: 'Arquivar/desarquivar chat', description: 'Arquiva ou desarquiva uma conversa.', risk: 'write', signature: 'archiveChat(chatId, option?)' },
  { scope: 'wpp:pinChat', method: 'pinChat', category: 'Conversas · Gestão', label: 'Fixar/desafixar chat', description: 'Fixa ou remove uma conversa dos chats fixados.', risk: 'write', signature: 'pinChat(chatId, option, nonExistent?)' },
  { scope: 'wpp:sendMute', method: 'sendMute', category: 'Conversas · Gestão', label: 'Silenciar chat', description: 'Silencia uma conversa por minutos, horas ou período suportado.', risk: 'write', signature: 'sendMute(chatId, time, type)' },
  { scope: 'wpp:sendSeen', method: 'sendSeen', category: 'Conversas · Gestão', label: 'Marcar como lida', description: 'Marca mensagens do chat como vistas.', risk: 'write', signature: 'sendSeen(chatId)' },
  { scope: 'wpp:markUnseenMessage', method: 'markUnseenMessage', category: 'Conversas · Gestão', label: 'Marcar como não lida', description: 'Marca uma conversa como não lida.', risk: 'write', signature: 'markUnseenMessage(chatId)' },
  { scope: 'wpp:setTemporaryMessages', method: 'setTemporaryMessages', category: 'Conversas · Gestão', label: 'Mensagens temporárias', description: 'Ativa ou desativa mensagens temporárias no chat/grupo.', risk: 'write', signature: 'setTemporaryMessages(chatOrGroupId, enabled)' },
  { scope: 'wpp:clearChat', method: 'clearChat', category: 'Conversas · Gestão', label: 'Limpar mensagens do chat', description: 'Apaga as mensagens do chat, com opção de preservar favoritas.', risk: 'destructive', signature: 'clearChat(chatId, keepStarred?)' },
  { scope: 'wpp:deleteChat', method: 'deleteChat', category: 'Conversas · Gestão', label: 'Excluir chat', description: 'Exclui uma conversa da conta.', risk: 'destructive', signature: 'deleteChat(chatId)' },

  // Message actions
  { scope: 'wpp:sendText', method: 'sendText', category: 'Mensagens · Envio', label: 'Enviar texto', description: 'Envia nova mensagem de texto. Pode receber opções do WPPConnect.', risk: 'write', signature: 'sendText(to, content, options?)' },
  { scope: 'wpp:reply', method: 'reply', category: 'Mensagens · Interação', label: 'Responder mensagem', description: 'Responde uma mensagem específica. Útil para advertências contextuais em grupos.', risk: 'write', signature: 'reply(to, content, quotedMessageId)' },
  { scope: 'wpp:editMessage', method: 'editMessage', category: 'Mensagens · Interação', label: 'Editar mensagem', description: 'Edita uma mensagem enviada quando permitido pelo WhatsApp.', risk: 'write', signature: 'editMessage(messageId, newText, options?)' },
  { scope: 'wpp:deleteMessage', method: 'deleteMessage', category: 'Mensagens · Interação', label: 'Apagar mensagem', description: 'Apaga uma ou mais mensagens, localmente ou para todos conforme suporte.', risk: 'destructive', signature: 'deleteMessage(chatId, messageIdOrIds, onlyLocal?, deleteMediaInDevice?)' },
  { scope: 'wpp:forwardMessagesV2', method: 'forwardMessagesV2', category: 'Mensagens · Interação', label: 'Encaminhar mensagem', description: 'Encaminha uma ou mais mensagens para outro chat.', risk: 'write', signature: 'forwardMessagesV2(toChatId, messageIdOrIds, options?)' },
  { scope: 'wpp:sendReactionToMessage', method: 'sendReactionToMessage', category: 'Mensagens · Interação', label: 'Reagir com emoji', description: 'Adiciona ou remove reação de uma mensagem.', risk: 'write', signature: 'sendReactionToMessage(messageId, reactionOrFalse)' },
  { scope: 'wpp:starMessage', method: 'starMessage', category: 'Mensagens · Interação', label: 'Favoritar mensagem', description: 'Marca ou desmarca mensagens com estrela.', risk: 'write', signature: 'starMessage(messageIdOrIds, star?)' },
  { scope: 'wpp:markPlayed', method: 'markPlayed', category: 'Mensagens · Interação', label: 'Marcar mídia como reproduzida', description: 'Marca áudio ou mídia de visualização única como reproduzida.', risk: 'write', signature: 'markPlayed(messageId)' },
  { scope: 'wpp:sendPollMessage', method: 'sendPollMessage', category: 'Mensagens · Envio', label: 'Enviar enquete', description: 'Cria enquete com opções e quantidade selecionável.', risk: 'write', signature: 'sendPollMessage(chatId, name, choices, options?)' },
  { scope: 'wpp:sendLocation', method: 'sendLocation', category: 'Mensagens · Envio', label: 'Enviar localização', description: 'Envia uma localização para o chat.', risk: 'write', signature: 'sendLocation(to, options) ou sendLocation(to, latitude, longitude, title)' },
  { scope: 'wpp:sendContactVcard', method: 'sendContactVcard', category: 'Mensagens · Envio', label: 'Enviar contato', description: 'Envia um cartão de contato/vCard.', risk: 'write', signature: 'sendContactVcard(to, contactId, name?)' },
  { scope: 'wpp:sendContactVcardList', method: 'sendContactVcardList', category: 'Mensagens · Envio', label: 'Enviar lista de contatos', description: 'Envia múltiplos cartões de contato.', risk: 'write', signature: 'sendContactVcardList(to, contacts)' },
  { scope: 'wpp:sendFile', method: 'sendFile', category: 'Mensagens · Envio', label: 'Enviar arquivo/mídia', description: 'Envia arquivo, imagem, vídeo ou base64 com opções.', risk: 'write', signature: 'sendFile(to, pathOrBase64, options?)' },
  { scope: 'wpp:sendImage', method: 'sendImage', category: 'Mensagens · Envio', label: 'Enviar imagem', description: 'Envia imagem ao chat.', risk: 'write', signature: 'sendImage(to, pathOrBase64, filename?, caption?, quotedMessageId?)' },
  { scope: 'wpp:sendGif', method: 'sendGif', category: 'Mensagens · Envio', label: 'Enviar GIF', description: 'Envia GIF ao chat.', risk: 'write', signature: 'sendGif(to, pathOrBase64, filename?, caption?)' },
  { scope: 'wpp:sendPtt', method: 'sendPtt', category: 'Mensagens · Envio', label: 'Enviar áudio/voz', description: 'Envia áudio como mensagem de voz PTT.', risk: 'write', signature: 'sendPtt(to, filePath, filename?, quotedMessageId?)' },
  { scope: 'wpp:sendLinkPreview', method: 'sendLinkPreview', category: 'Mensagens · Envio', label: 'Enviar link com preview', description: 'Envia link com pré-visualização quando suportado.', risk: 'write', signature: 'sendLinkPreview(to, url, text?)' },
  { scope: 'wpp:sendMentioned', method: 'sendMentioned', category: 'Mensagens · Envio', label: 'Enviar menção', description: 'Envia mensagem mencionando participantes.', risk: 'write', signature: 'sendMentioned(to, content, mentionedIds...)' },
  { scope: 'wpp:sendListMessage', method: 'sendListMessage', category: 'Mensagens · Envio', label: 'Enviar lista interativa', description: 'Envia mensagem de lista interativa com seções e opções.', risk: 'write', signature: 'sendListMessage(to, options)' },

  // Contact data
  { scope: 'wpp:getAllContacts', method: 'getAllContacts', category: 'Contatos · Consulta', label: 'Listar contatos', description: 'Lista contatos visíveis na conta.', risk: 'read', signature: 'getAllContacts()' },
  { scope: 'wpp:getContact', method: 'getContact', category: 'Contatos · Consulta', label: 'Consultar contato', description: 'Consulta dados de um contato.', risk: 'read', signature: 'getContact(contactId)' },
  { scope: 'wpp:checkNumberStatus', method: 'checkNumberStatus', category: 'Contatos · Consulta', label: 'Verificar número', description: 'Verifica se um número existe/está disponível no WhatsApp.', risk: 'read', signature: 'checkNumberStatus(contactId)' },
  { scope: 'wpp:getNumberProfile', method: 'getNumberProfile', category: 'Contatos · Consulta', label: 'Consultar perfil do número', description: 'Consulta informações públicas do perfil do número.', risk: 'read', signature: 'getNumberProfile(contactId)' },
  { scope: 'wpp:getProfilePicFromServer', method: 'getProfilePicFromServer', category: 'Contatos · Consulta', label: 'Consultar foto de perfil', description: 'Obtém URL/base de foto de perfil visível para a conta.', risk: 'read', signature: 'getProfilePicFromServer(contactId)' },
  { scope: 'wpp:getStatus', method: 'getStatus', category: 'Contatos · Consulta', label: 'Consultar recado/status', description: 'Consulta o recado/status textual visível de um contato.', risk: 'read', signature: 'getStatus(contactId)' },
  { scope: 'wpp:getCommonGroups', method: 'getCommonGroups', category: 'Contatos · Consulta', label: 'Grupos em comum', description: 'Lista grupos em comum com um contato.', risk: 'read', signature: 'getCommonGroups(contactId)' },

  // Groups
  { scope: 'wpp:getGroupMembers', method: 'getGroupMembers', category: 'Grupos · Consulta', label: 'Listar participantes', description: 'Lista participantes de um grupo.', risk: 'read', signature: 'getGroupMembers(groupId)' },
  { scope: 'wpp:getGroupMembersIds', method: 'getGroupMembersIds', category: 'Grupos · Consulta', label: 'Listar IDs dos participantes', description: 'Retorna os IDs dos participantes do grupo.', risk: 'read', signature: 'getGroupMembersIds(groupId)' },
  { scope: 'wpp:getGroupAdmins', method: 'getGroupAdmins', category: 'Grupos · Consulta', label: 'Listar administradores', description: 'Lista os administradores do grupo.', risk: 'read', signature: 'getGroupAdmins(groupId)' },
  { scope: 'wpp:getGroupInviteLink', method: 'getGroupInviteLink', category: 'Grupos · Convites', label: 'Obter link de convite', description: 'Obtém o link de convite atual do grupo.', risk: 'read', signature: 'getGroupInviteLink(groupId)' },
  { scope: 'wpp:getGroupInfoFromInviteLink', method: 'getGroupInfoFromInviteLink', category: 'Grupos · Convites', label: 'Consultar convite', description: 'Consulta informações de um grupo a partir de link/código de convite.', risk: 'read', signature: 'getGroupInfoFromInviteLink(inviteCodeOrLink)' },
  { scope: 'wpp:getGroupMembershipRequests', method: 'getGroupMembershipRequests', category: 'Grupos · Solicitações', label: 'Pedidos de entrada', description: 'Lista solicitações pendentes de entrada no grupo.', risk: 'read', signature: 'getGroupMembershipRequests(groupId)' },
  { scope: 'wpp:getGroupSizeLimit', method: 'getGroupSizeLimit', category: 'Grupos · Consulta', label: 'Limite do grupo', description: 'Consulta o limite de participantes suportado.', risk: 'read', signature: 'getGroupSizeLimit()' },
  { scope: 'wpp:joinGroup', method: 'joinGroup', category: 'Grupos · Convites', label: 'Entrar no grupo', description: 'Entra em grupo por link ou código de convite.', risk: 'write', signature: 'joinGroup(inviteCodeOrLink)' },
  { scope: 'wpp:createGroup', method: 'createGroup', category: 'Grupos · Gestão', label: 'Criar grupo', description: 'Cria um grupo com participantes iniciais.', risk: 'write', signature: 'createGroup(groupName, contactIds)' },
  { scope: 'wpp:leaveGroup', method: 'leaveGroup', category: 'Grupos · Gestão', label: 'Sair do grupo', description: 'Remove a própria conta do grupo.', risk: 'destructive', signature: 'leaveGroup(groupId)' },
  { scope: 'wpp:addParticipant', method: 'addParticipant', category: 'Grupos · Participantes', label: 'Adicionar participante', description: 'Adiciona uma ou mais pessoas ao grupo.', risk: 'write', signature: 'addParticipant(groupId, participantIdOrIds)' },
  { scope: 'wpp:removeParticipant', method: 'removeParticipant', category: 'Grupos · Participantes', label: 'Remover participante', description: 'Remove uma ou mais pessoas do grupo. Útil em moderação.', risk: 'destructive', signature: 'removeParticipant(groupId, participantIdOrIds)' },
  { scope: 'wpp:promoteParticipant', method: 'promoteParticipant', category: 'Grupos · Participantes', label: 'Promover administrador', description: 'Promove participante a administrador.', risk: 'write', signature: 'promoteParticipant(groupId, participantIdOrIds)' },
  { scope: 'wpp:demoteParticipant', method: 'demoteParticipant', category: 'Grupos · Participantes', label: 'Rebaixar administrador', description: 'Remove privilégios de administrador.', risk: 'destructive', signature: 'demoteParticipant(groupId, participantIdOrIds)' },
  { scope: 'wpp:approveGroupMembershipRequest', method: 'approveGroupMembershipRequest', category: 'Grupos · Solicitações', label: 'Aprovar pedido de entrada', description: 'Aprova uma ou mais solicitações de participação.', risk: 'write', signature: 'approveGroupMembershipRequest(groupId, participantIdOrIds)' },
  { scope: 'wpp:rejectGroupMembershipRequest', method: 'rejectGroupMembershipRequest', category: 'Grupos · Solicitações', label: 'Rejeitar pedido de entrada', description: 'Rejeita uma ou mais solicitações de participação.', risk: 'destructive', signature: 'rejectGroupMembershipRequest(groupId, participantIdOrIds)' },
  { scope: 'wpp:revokeGroupInviteLink', method: 'revokeGroupInviteLink', category: 'Grupos · Convites', label: 'Revogar link de convite', description: 'Invalida o link de convite atual do grupo.', risk: 'destructive', signature: 'revokeGroupInviteLink(groupId)' },
  { scope: 'wpp:setGroupSubject', method: 'setGroupSubject', category: 'Grupos · Configuração', label: 'Alterar nome', description: 'Altera o nome/assunto do grupo.', risk: 'write', signature: 'setGroupSubject(groupId, title)' },
  { scope: 'wpp:setGroupDescription', method: 'setGroupDescription', category: 'Grupos · Configuração', label: 'Alterar descrição', description: 'Altera a descrição do grupo.', risk: 'write', signature: 'setGroupDescription(groupId, description)' },
  { scope: 'wpp:setGroupIcon', method: 'setGroupIcon', category: 'Grupos · Configuração', label: 'Alterar imagem do grupo', description: 'Define a imagem/ícone do grupo.', risk: 'write', signature: 'setGroupIcon(groupId, image)' },
  { scope: 'wpp:removeGroupIcon', method: 'removeGroupIcon', category: 'Grupos · Configuração', label: 'Remover imagem do grupo', description: 'Remove o ícone do grupo.', risk: 'destructive', signature: 'removeGroupIcon(groupId)' },
  { scope: 'wpp:setMessagesAdminsOnly', method: 'setMessagesAdminsOnly', category: 'Grupos · Configuração', label: 'Somente admins podem falar', description: 'Ativa ou desativa envio de mensagens apenas por administradores.', risk: 'write', signature: 'setMessagesAdminsOnly(groupId, enabled)' },
  { scope: 'wpp:setGroupProperty', method: 'setGroupProperty', category: 'Grupos · Configuração', label: 'Alterar propriedade do grupo', description: 'Altera propriedade administrativa suportada pelo WhatsApp.', risk: 'write', signature: 'setGroupProperty(groupId, property, enabled)' },

  // Communities
  { scope: 'wpp:getCommunityParticipants', method: 'getCommunityParticipants', category: 'Comunidades', label: 'Participantes da comunidade', description: 'Consulta participantes de uma comunidade.', risk: 'read', signature: 'getCommunityParticipants(communityId)' },
  { scope: 'wpp:createCommunity', method: 'createCommunity', category: 'Comunidades', label: 'Criar comunidade', description: 'Cria uma comunidade.', risk: 'write', signature: 'createCommunity(name, description, options?)' },
  { scope: 'wpp:addSubgroupsCommunity', method: 'addSubgroupsCommunity', category: 'Comunidades', label: 'Adicionar subgrupo', description: 'Adiciona grupos a uma comunidade.', risk: 'write', signature: 'addSubgroupsCommunity(communityId, subgroupIds)' },
  { scope: 'wpp:removeSubgroupsCommunity', method: 'removeSubgroupsCommunity', category: 'Comunidades', label: 'Remover subgrupo', description: 'Remove grupos de uma comunidade.', risk: 'destructive', signature: 'removeSubgroupsCommunity(communityId, subgroupIds)' },
  { scope: 'wpp:promoteCommunityParticipant', method: 'promoteCommunityParticipant', category: 'Comunidades', label: 'Promover admin da comunidade', description: 'Promove participante dentro da comunidade.', risk: 'write', signature: 'promoteCommunityParticipant(communityId, participantIds)' },
  { scope: 'wpp:demoteCommunityParticipant', method: 'demoteCommunityParticipant', category: 'Comunidades', label: 'Rebaixar admin da comunidade', description: 'Remove privilégios de participante dentro da comunidade.', risk: 'destructive', signature: 'demoteCommunityParticipant(communityId, participantIds)' },
  { scope: 'wpp:deactivateCommunity', method: 'deactivateCommunity', category: 'Comunidades', label: 'Desativar comunidade', description: 'Desativa uma comunidade administrada pela conta.', risk: 'destructive', signature: 'deactivateCommunity(communityId)' },

  // Labels
  { scope: 'wpp:getAllLabels', method: 'getAllLabels', category: 'Organização · Etiquetas', label: 'Listar etiquetas', description: 'Lista labels do WhatsApp Business.', risk: 'read', signature: 'getAllLabels()' },
  { scope: 'wpp:getLabelById', method: 'getLabelById', category: 'Organização · Etiquetas', label: 'Consultar etiqueta', description: 'Consulta uma label por ID.', risk: 'read', signature: 'getLabelById(labelId)' },
  { scope: 'wpp:addNewLabel', method: 'addNewLabel', category: 'Organização · Etiquetas', label: 'Criar etiqueta', description: 'Cria uma nova etiqueta.', risk: 'write', signature: 'addNewLabel(name, options?)' },
  { scope: 'wpp:addOrRemoveLabels', method: 'addOrRemoveLabels', category: 'Organização · Etiquetas', label: 'Aplicar/remover etiqueta', description: 'Aplica ou remove labels de chats. Pode servir como fila de aviso/moderação.', risk: 'write', signature: 'addOrRemoveLabels(chatIds, operations)' },
  { scope: 'wpp:deleteLabel', method: 'deleteLabel', category: 'Organização · Etiquetas', label: 'Excluir etiqueta', description: 'Exclui uma ou mais etiquetas.', risk: 'destructive', signature: 'deleteLabel(labelIdOrIds)' },
  { scope: 'wpp:deleteAllLabels', method: 'deleteAllLabels', category: 'Organização · Etiquetas', label: 'Excluir todas as etiquetas', description: 'Remove todas as labels da conta.', risk: 'destructive', signature: 'deleteAllLabels()' },

  // Lists
  { scope: 'wpp:getAllLists', method: 'getAllLists', category: 'Organização · Listas', label: 'Listar listas', description: 'Lista listas customizadas e seus chats.', risk: 'read', signature: 'getAllLists()' },
  { scope: 'wpp:createList', method: 'createList', category: 'Organização · Listas', label: 'Criar lista', description: 'Cria lista e opcionalmente adiciona chats.', risk: 'write', signature: 'createList(name, chatIds?, colorIndex?)' },
  { scope: 'wpp:addChatsToList', method: 'addChatsToList', category: 'Organização · Listas', label: 'Adicionar à lista', description: 'Inclui chats em uma lista. Útil para listas de acompanhamento/aviso.', risk: 'write', signature: 'addChatsToList(listId, chatIds)' },
  { scope: 'wpp:removeChatsFromList', method: 'removeChatsFromList', category: 'Organização · Listas', label: 'Remover da lista', description: 'Remove chats de uma lista.', risk: 'write', signature: 'removeChatsFromList(listId, chatIds)' },
  { scope: 'wpp:renameList', method: 'renameList', category: 'Organização · Listas', label: 'Renomear lista', description: 'Renomeia uma lista.', risk: 'write', signature: 'renameList(listId, newName)' },
  { scope: 'wpp:deleteList', method: 'deleteList', category: 'Organização · Listas', label: 'Excluir lista', description: 'Exclui uma lista.', risk: 'destructive', signature: 'deleteList(listId)' },

  // Newsletter / channels
  { scope: 'wpp:createNewsletter', method: 'createNewsletter', category: 'Canais', label: 'Criar canal', description: 'Cria newsletter/canal com nome, descrição e imagem opcionais.', risk: 'write', signature: 'createNewsletter(name, options?)', experimental: true },
  { scope: 'wpp:editNewsletter', method: 'editNewsletter', category: 'Canais', label: 'Editar canal', description: 'Edita nome, descrição ou imagem de canal.', risk: 'write', signature: 'editNewsletter(channelId, options?)', experimental: true },
  { scope: 'wpp:muteNesletter', method: 'muteNesletter', category: 'Canais', label: 'Silenciar canal', description: 'Silencia newsletter/canal.', risk: 'write', signature: 'muteNesletter(channelId)', experimental: true },
  { scope: 'wpp:destroyNewsletter', method: 'destroyNewsletter', category: 'Canais', label: 'Excluir canal', description: 'Exclui uma newsletter/canal.', risk: 'destructive', signature: 'destroyNewsletter(channelId)', experimental: true },

  // Profile/business
  { scope: 'wpp:getProfileName', method: 'getProfileName', category: 'Perfil', label: 'Consultar nome do perfil', description: 'Consulta o nome configurado no próprio WhatsApp.', risk: 'read', signature: 'getProfileName()' },
  { scope: 'wpp:getProfileStatus', method: 'getProfileStatus', category: 'Perfil', label: 'Consultar recado do perfil', description: 'Consulta o recado/status do próprio perfil.', risk: 'read', signature: 'getProfileStatus()' },
  { scope: 'wpp:setProfileName', method: 'setProfileName', category: 'Perfil', label: 'Alterar nome do perfil', description: 'Altera o nome do próprio perfil.', risk: 'write', signature: 'setProfileName(name)' },
  { scope: 'wpp:setProfileStatus', method: 'setProfileStatus', category: 'Perfil', label: 'Alterar recado do perfil', description: 'Altera o recado/status textual do próprio perfil.', risk: 'write', signature: 'setProfileStatus(status)' },
  { scope: 'wpp:setProfilePic', method: 'setProfilePic', category: 'Perfil', label: 'Alterar foto do perfil', description: 'Define nova foto do próprio perfil.', risk: 'write', signature: 'setProfilePic(pathOrBase64)' },
  { scope: 'wpp:removeMyProfilePicture', method: 'removeMyProfilePicture', category: 'Perfil', label: 'Remover foto do perfil', description: 'Remove a foto do próprio perfil.', risk: 'destructive', signature: 'removeMyProfilePicture()' },
  { scope: 'wpp:getBusinessProfile', method: 'getBusinessProfile', category: 'Negócio', label: 'Consultar perfil comercial', description: 'Consulta o perfil comercial de um ID.', risk: 'read', signature: 'getBusinessProfile(businessId)' },
  { scope: 'wpp:editBusinessProfile', method: 'editBusinessProfile', category: 'Negócio', label: 'Editar perfil comercial', description: 'Edita campos suportados do perfil comercial.', risk: 'write', signature: 'editBusinessProfile(options)' },

  // Catalog
  { scope: 'wpp:getBusinessProfilesProducts', method: 'getBusinessProfilesProducts', category: 'Catálogo · Consulta', label: 'Produtos do perfil comercial', description: 'Consulta produtos associados a um perfil comercial.', risk: 'read', signature: 'getBusinessProfilesProducts(businessId)' },
  { scope: 'wpp:getProducts', method: 'getProducts', category: 'Catálogo · Consulta', label: 'Listar produtos', description: 'Lista produtos de um catálogo.', risk: 'read', signature: 'getProducts(businessId, quantity?)' },
  { scope: 'wpp:getProductById', method: 'getProductById', category: 'Catálogo · Consulta', label: 'Consultar produto', description: 'Consulta produto específico por ID.', risk: 'read', signature: 'getProductById(businessId, productId)' },
  { scope: 'wpp:getCollections', method: 'getCollections', category: 'Catálogo · Consulta', label: 'Listar coleções', description: 'Consulta coleções de produtos.', risk: 'read', signature: 'getCollections(businessId, quantity, maxProducts)' },
  { scope: 'wpp:createProduct', method: 'createProduct', category: 'Catálogo · Gestão', label: 'Criar produto', description: 'Cria produto no catálogo.', risk: 'write', signature: 'createProduct(name, image, description, price, isHidden, url, retailerId, currency)' },
  { scope: 'wpp:editProduct', method: 'editProduct', category: 'Catálogo · Gestão', label: 'Editar produto', description: 'Edita dados de produto.', risk: 'write', signature: 'editProduct(productId, options)' },
  { scope: 'wpp:delProducts', method: 'delProducts', category: 'Catálogo · Gestão', label: 'Excluir produtos', description: 'Exclui um ou vários produtos do catálogo.', risk: 'destructive', signature: 'delProducts(productIds)' },
  { scope: 'wpp:addProductImage', method: 'addProductImage', category: 'Catálogo · Gestão', label: 'Adicionar imagem ao produto', description: 'Adiciona imagem adicional ao produto.', risk: 'write', signature: 'addProductImage(productId, imageBase64)' },
  { scope: 'wpp:changeProductImage', method: 'changeProductImage', category: 'Catálogo · Gestão', label: 'Trocar imagem principal', description: 'Altera a imagem principal do produto.', risk: 'write', signature: 'changeProductImage(productId, imageBase64)' },
  { scope: 'wpp:removeProductImage', method: 'removeProductImage', category: 'Catálogo · Gestão', label: 'Remover imagem do produto', description: 'Remove imagem adicional do produto.', risk: 'destructive', signature: 'removeProductImage(productId, index)' },
  { scope: 'wpp:setProductVisibility', method: 'setProductVisibility', category: 'Catálogo · Gestão', label: 'Alterar visibilidade do produto', description: 'Mostra ou oculta produto no catálogo.', risk: 'write', signature: 'setProductVisibility(productId, visible)' },
  { scope: 'wpp:createCollection', method: 'createCollection', category: 'Catálogo · Coleções', label: 'Criar coleção', description: 'Cria coleção de produtos.', risk: 'write', signature: 'createCollection(name, productIds)' },
  { scope: 'wpp:editCollection', method: 'editCollection', category: 'Catálogo · Coleções', label: 'Editar coleção', description: 'Edita nome e produtos de uma coleção.', risk: 'write', signature: 'editCollection(collectionId, options)' },
  { scope: 'wpp:deleteCollection', method: 'deleteCollection', category: 'Catálogo · Coleções', label: 'Excluir coleção', description: 'Exclui coleção do catálogo.', risk: 'destructive', signature: 'deleteCollection(collectionId)' },
  { scope: 'wpp:updateCartEnabled', method: 'updateCartEnabled', category: 'Catálogo · Carrinho', label: 'Ativar/desativar carrinho', description: 'Controla o carrinho comercial do catálogo.', risk: 'write', signature: 'updateCartEnabled(enabled)' },

  // Status
  { scope: 'wpp:sendTextStatus', method: 'sendTextStatus', category: 'Status', label: 'Publicar status de texto', description: 'Publica status/story de texto.', risk: 'write', signature: 'sendTextStatus(text, options?)' },
  { scope: 'wpp:sendImageStatus', method: 'sendImageStatus', category: 'Status', label: 'Publicar status de imagem', description: 'Publica imagem no status.', risk: 'write', signature: 'sendImageStatus(pathOrBase64, options?)' },
  { scope: 'wpp:sendVideoStatus', method: 'sendVideoStatus', category: 'Status', label: 'Publicar status de vídeo', description: 'Publica vídeo no status.', risk: 'write', signature: 'sendVideoStatus(pathOrBase64, options?)' },
  { scope: 'wpp:sendReadStatus', method: 'sendReadStatus', category: 'Status', label: 'Marcar status como visto', description: 'Envia confirmação de leitura de um status.', risk: 'write', signature: 'sendReadStatus(chatId, statusId)' },

  // Presence
  { scope: 'wpp:getChatIsOnline', method: 'getChatIsOnline', category: 'Presença', label: 'Consultar online', description: 'Consulta se um chat está online quando disponível.', risk: 'read', signature: 'getChatIsOnline(chatId)' },
  { scope: 'wpp:getLastSeen', method: 'getLastSeen', category: 'Presença', label: 'Consultar último acesso', description: 'Consulta último acesso quando as regras de privacidade permitem.', risk: 'read', signature: 'getLastSeen(chatId)' },
  { scope: 'wpp:subscribePresence', method: 'subscribePresence', category: 'Presença', label: 'Assinar presença', description: 'Assina atualizações de presença para contatos/grupos.', risk: 'read', signature: 'subscribePresence(idOrIds)' },
  { scope: 'wpp:unsubscribePresence', method: 'unsubscribePresence', category: 'Presença', label: 'Cancelar presença', description: 'Cancela assinatura de presença.', risk: 'write', signature: 'unsubscribePresence(idOrIds)' },
  { scope: 'wpp:setOnlinePresence', method: 'setOnlinePresence', category: 'Presença', label: 'Definir online/offline', description: 'Controla presença online da própria conta.', risk: 'write', signature: 'setOnlinePresence(online?)' },
  { scope: 'wpp:startTyping', method: 'startTyping', category: 'Presença', label: 'Indicar digitando', description: 'Mostra estado digitando em um chat.', risk: 'write', signature: 'startTyping(chatId)' },
  { scope: 'wpp:stopTyping', method: 'stopTyping', category: 'Presença', label: 'Parar digitando', description: 'Remove estado digitando.', risk: 'write', signature: 'stopTyping(chatId)' },
  { scope: 'wpp:startRecording', method: 'startRecording', category: 'Presença', label: 'Indicar gravando áudio', description: 'Mostra estado gravando áudio em um chat.', risk: 'write', signature: 'startRecording(chatId)' },
  { scope: 'wpp:stopRecording', method: 'stopRecording', category: 'Presença', label: 'Parar gravando áudio', description: 'Remove estado gravando áudio.', risk: 'write', signature: 'stopRecording(chatId)' },

  // Orders/calls/broadcast
  { scope: 'wpp:getOrder', method: 'getOrder', category: 'Pedidos', label: 'Consultar pedido', description: 'Consulta informações de pedido pelo ID.', risk: 'read', signature: 'getOrder(messageId)' },
  { scope: 'wpp:getOrderbyMsg', method: 'getOrderbyMsg', category: 'Pedidos', label: 'Pedido por mensagem', description: 'Consulta pedido comercial associado a uma mensagem.', risk: 'read', signature: 'getOrderbyMsg(messageId)' },
  { scope: 'wpp:rejectCall', method: 'rejectCall', category: 'Chamadas', label: 'Rejeitar chamada', description: 'Rejeita chamada específica ou chamadas recebidas.', risk: 'write', signature: 'rejectCall(callId?)' },
  { scope: 'wpp:getAllBroadcastList', method: 'getAllBroadcastList', category: 'Listas de transmissão', label: 'Listar transmissões', description: 'Consulta listas de transmissão visíveis na conta.', risk: 'read', signature: 'getAllBroadcastList()' },
] as const;

export type WppOperationCapability = (typeof WPP_OPERATION_CAPABILITIES)[number];
