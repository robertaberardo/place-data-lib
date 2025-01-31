/**
 * Erro estruturado que pode ser usado para erros em requisições,
 * como erros de validação de dados.
 *
 * Um manipulador pode lançar este erro e ele será devidamente serializado
 * como parte da resposta e desserializado do outro lado. Isso permite
 * retornar erros com contexto adicional como uma primitiva de baixo nível.
 */
export class RequestError extends Error {
    type;
    data;
    constructor(message, type, data, options) {
        super(message, {
            cause: options?.cause,
        });
        this.type = type;
        this.data = data;
        this.name = "RequestError";
    }
}

/**
 * Analisa o payload do erro.
 * @param {any} payload - O payload do erro.
 * @returns {Error|RequestError} - O erro analisado.
 */
function parseErrorPayload(payload) {
    if (payload instanceof Error) {
        return payload;
    }
    if (payload != null &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string" &&
        "type" in payload &&
        typeof payload.type === "string" &&
        "data" in payload) {
        return new RequestError(payload.message, payload.type, payload.data);
    }
    console.error("Erro desconhecido", payload);
    throw new Error("Ocorreu um erro desconhecido. Veja o console");
}

/**
 * Converte um erro em um payload de erro.
 * @param {Error} error - O erro a ser convertido.
 * @returns {object} - O payload do erro.
 */
function toErrorPayload(error) {
    if (error instanceof RequestError) {
        return {
            message: error.message,
            type: error.type,
            data: error.data,
        };
    }
    return error;
}

const messageTypeRequest = "IFRAME-MESSAGE-REQUEST";
const messageTypeResponse = "IFRAME-MESSAGE-RESPONSE";
const messageTypeEvent = "IFRAME-MESSAGE-EVENT";

/**
 * Verifica se os dados são uma requisição.
 * @param {object} data - Os dados a serem verificados.
 * @returns {boolean} - Verdadeiro se for uma requisição, falso caso contrário.
 */
function isRequest(data) {
    return (typeof data === "object" &&
        data != null &&
        "id" in data &&
        "action" in data &&
        "type" in data &&
        data.type === messageTypeRequest);
}

/**
 * Verifica se os dados são uma resposta.
 * @param {object} data - Os dados a serem verificados.
 * @returns {boolean} - Verdadeiro se for uma resposta, falso caso contrário.
 */
function isResponse(data) {
    return (typeof data === "object" &&
        data != null &&
        "id" in data &&
        "type" in data &&
        data.type == messageTypeResponse);
}

/**
 * Verifica se os dados são um evento.
 * @param {object} data - Os dados a serem verificados.
 * @returns {boolean} - Verdadeiro se for um evento, falso caso contrário.
 */
function isEvent(data) {
    return (typeof data === "object" &&
        data != null &&
        "action" in data &&
        "type" in data &&
        data.type === messageTypeEvent);
}


/**
 * IframeMessenger lida com a comunicação dentro/fora de um iframe.
 *
 * Ele cria uma abstração em cima da API Window.postMessage() do navegador
 * para tornar mais conveniente a passagem de mensagens
 * e o roteamento de mensagens para manipuladores.
 *
 * Funcionalidades fornecidas:
 *
 * - Enviar requisições e aguardar a resposta. Pense nisso
 *   como uma forma de fazer funções assíncronas entre janelas do navegador. 
 *   Como a comunicação entre janelas é assíncrona, não há suporte para
 *   requisições síncronas.
 *
 * - Enviar eventos para a outra janela. Eventos são mensagens unidirecionais que
 *   não esperam uma resposta.
 *
 * - TODO: Implementar Subscriptions, precisa garantir a conexão.
 * - TODO: Implementar validação de origem e source.
 */
export default class IframeMessenger {

    #origin;
    #requestHandlers;
    #eventHandlers;

    /**
     * Construtor da classe IframeMessenger.
     * @param {object} options - As opções para o IframeMessenger.
     */
    constructor(options) {
        this.debug = false;

        this.source = options.source;  // No iframe, esse será o pai, no pai, esse será o iframe
        this.#origin = "*"; // TODO: por enquanto deixar assim, mas depois mudar para origin e começar fazer vlaidçaão
        this.#requestHandlers = new Map();
        this.#eventHandlers = new Map();

        // Registra função que irá lidar com eventos recebidos
        window.addEventListener("message", this.#messageHandler);
    }

    /**
     * Envia uma requisição para o outro lado da comunicação.
     * @param {string} action - A ação da requisição.
     * @param {any} payload - O payload da requisição.
     * @returns {Promise<any>} - A resposta da requisição.
     */
    async sendRequest(action, payload) {
        const id = crypto.randomUUID();
        const responsePromise = this.#receiveRequestResponse(id);
        const message = {
            id,
            type: messageTypeRequest,
            action,
            payload,
        };
        const [response] = await Promise.all([
            responsePromise,
            this.source.postMessage(message, this.#origin),
        ]);
        return response;
    }

    /**
     * Aguarda a resposta de uma requisição específica.
     * @param {string} id - O ID da requisição.
     * @returns {Promise<any>} - A resposta da requisição.
     */
    #receiveRequestResponse(id) {
        let callback;
        return new Promise((resolve, reject) => {
            callback = (event) => {
                if (isResponse(event.data) &&
                    event.data.id === id) {
                        console.log('event.data', event.data)
                    if (event.data.error) {
                        reject(parseErrorPayload(event.data.payload));
                    }
                    else {
                        resolve(event.data.payload);
                    }
                }
            };
            window.addEventListener("message", callback);
        }).finally(() => {
            window.removeEventListener("message", callback);
        });
    }

    /**
     * Encaminha mensagens recebidas para .
     * @param {MessageEvent} message - O evento de mensagem.
     */
    #messageHandler = (message) => {
        const source = message.source;
        if (source == null || source !== this.source ) {
            return;
        } // TODO: adicionar também validação da origem 
        if (this.debug) {
            console.log(`Mensagem da origem ${message.origin}:`, message.data);
        }

        message.sourcem

        const data = message.data;
        if (isEvent(data)) {
            this.#handleEvent(data);
        }
        if (isRequest(data)) {
            console.log('isRequest', data)
            this.#handleRequest(data, source);
        }
    };

    /**
     * Registra as funções que serão chamadas caso exista uma requisição daquele tipo.
     * @param {string} action - A ação da requisição.
     * @param {Function} handler - O manipulador da requisição.
     */
    registerRequestHandler(action, handler) {
        console.log('registerRequestHandler', action, handler)
        this.#requestHandlers.set(action, handler);
    }

    /**
     * Lida com o request recebido, encontra a função a ser chamada, e retorna uma resposta.
     * @param {object} request - A requisição recebida.
     * @param {Window} source - A origem da requisição.
     */
    #handleRequest(request, source) {
        const reply = (payload, error) => {
            const response = {
                id: request.id,
                type: messageTypeResponse,
                payload,
                error,
            };

            this.source.postMessage(response, this.#origin);
        };
        const handler = this.#requestHandlers.get(request.action);

        if (!handler) {
            console.warn("Ação desconhecida para a requisição", request);
            reply(new Error(`Ação desconhecida: ${request.action}`), true);
            return;
        }
        Promise.resolve()
            .then(() => handler(request.payload))
            .then((response) => {
            reply(response);
        })
            .catch((err) => {
            console.error(`Falha durante a ação da requisição ${request.action}`, err);
            reply(toErrorPayload(err), true);
        });
    }

    /**
     * Envia um evento para o outro lado da comunicação.
     * @param {string} action - A ação do evento.
     * @param {any} payload - O payload do evento.
     */
    async sendEvent(action, payload) {
        const message = {
            type: messageTypeEvent,
            action,
            payload,
        };
        await this.source.postMessage(message, this.#origin);
    }

    /**
     * Registra a função que será chamada para um tipo específico de evento.
     * @param {string} action - A ação do evento.
     * @param {Function} handler - O manipulador do evento.
     */
    registerEventsHandler(action, handler) {
        console.log('registerRequestHandler', action, handler)
        this.#eventHandlers.set(action, handler);
    }

    /**
     * Chama função registrada para um evento recebido.
     * @param {object} data - Os dados do evento.
     * @param {Window} source - A origem do evento.
     */
    #handleEvent(data, source) {
        let { action, payload, id } = data; // TODO: source(?)
        const handler = this.#eventHandlers.get(action);

        if (!handler) {
            if (this.debug) {
                console.log(`Nenhum manipulador para a ação: ${action}`);
            }
            return;
        }

        handler(payload);
    }
}