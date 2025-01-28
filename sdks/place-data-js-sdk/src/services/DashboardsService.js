import IframeMessenger from '../utils/IframeMessenger.js';
import { DASHBOARDS_REQUEST_IMAGES_FETCH, DASHBOARDS_EVENT_DATA_ON_CHANGE, DASHBOARDS_EVENT_ON_UPDATE } from '../constants.js';

/**
 * Serviço para inclusão no iframe que será usado para comunicação com o host do dashboard.
 */
export class IframeDashboardsService {
    #iframeMessenger;

    /**
     * @param {Window} hostWindow - Janela do host alvo para comunicação, window.parent.
     * @param {Object} options - Opções adicionais.
     */
    constructor(hostWindow, options = {}) {
        this.#iframeMessenger = new IframeMessenger({
            source: hostWindow
        });
    }

    /**
     * Registra a função que um manipulador para a solicitação de busca de imagens.
     * @param {Function} handler - Função que obtém images.
     */
    handleFetchImages(handler) {
        this.#iframeMessenger.registerRequestHandler(DASHBOARDS_REQUEST_IMAGES_FETCH, handler);
    }

    /**
     * Registra um callback que será chamado com a atualização de dados.
     * @param {Function} callback - Função de callback.
     */
    onDataUpdate(callback) {
        const wrapper = (data) => {
            try {
                const parsedData = JSON.parse(data);
                callback(parsedData);
            } catch (error) {
                console.error('Erro ao analisar dados', error);
            }
        }
        return this.#iframeMessenger.registerEventsHandler(DASHBOARDS_EVENT_DATA_ON_CHANGE, wrapper);
    }

    /**
     * Notifica o pai de uma atualização.
     */
    notifyUpdate = () => {
        this.#iframeMessenger.sendEvent(DASHBOARDS_EVENT_ON_UPDATE);
    }
}

/**
 * Serviço para inclusão no host que será usado para comunicação com o iframe do dashboard.
 */
export class HostDashboardsService {
    #iframeMessenger;

    /**
     * @param {Window} iframeWindow - Janela do iframe para comunicação, iframe.contentWidow.
     * @param {Object} options - Opções adicionais.
     */
    constructor(iframeWindow, options = {}) {
        this.#iframeMessenger = new IframeMessenger({
            source: iframeWindow
        });
    }

    /**
     * Solicita a busca de imagens.
     * @returns {Promise} - Promessa com o resultado da solicitação.
     */
    fetchImages = async () => {
        const payload = {};
        return await this.#iframeMessenger.sendRequest(DASHBOARDS_REQUEST_IMAGES_FETCH, payload);
    }

    /**
     * Envia para o iframe a a atualizaçaõ de dados com as features e boundary fornecidos.
     * @param {Array} features - Lista de features.
     * @param {Object} boundary - Objeto boundary.
     */
    updateData = (features, boundary) => {
        const message = JSON.stringify({
            features: features,
            boundary: boundary
        });
        this.#iframeMessenger.sendEvent(DASHBOARDS_EVENT_DATA_ON_CHANGE, message);
    }

    /**
     * Registra um callback para notificações de atualização dos dashboards na aplicação embedada.
     * @param {Function} callback - Função de callback.
     */
    onUpdate = (callback) => {
        return this.#iframeMessenger.registerEventsHandler(DASHBOARDS_EVENT_ON_UPDATE, callback);
    }
}

/**
 * Serviço principal para criação de serviços de dashboard.
 */
class DashboardsService {

    /**
     * Cria um serviço de iframe. Para ser incializada no Iframe.
     * @param {Window} hostWindow - Janela do parent, window.parent.
     * @param {Object} options - Opções adicionais.
     * @returns {IframeDashboardsService} - Instância do serviço do iframe.
     */
    static EmbeddedAppHandler(hostWindow, options = {}) {
        return new IframeDashboardsService(hostWindow, options);
    }

    /**
     * Cria um serviço de host. Para ser incializada no host.
     * @param {Window} iframeWindow - Janela do iframe, iframe.contentWindow.
     * @param {Object} options - Opções adicionais.
     * @returns {HostDashboardsService} - Instância do serviço do host.
     */
    static HostAppHandler(iframeWindow, options = {}) {
        return new HostDashboardsService(iframeWindow, options);
    }
}

export default DashboardsService;