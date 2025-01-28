import ParentDashboardService from './services/ParentDashboardService.js';
import IframeDashboardService from './services/IframeDashboardService.js';

// TODO: vou manter esse config mesmo? ou vou manter de outra forma
class PlaceData {

    static dashboards(config, mode) {
        if (!['parent', 'iframe'].includes(mode)) {
            throw new Error(`Modo inválido: ${mode}. Use 'parent' or 'iframe'.`);
        }

        // TODO: pensar nessa estrutura de config, mode
        // TODO: será que o new não deveria estar fora
        return mode === 'parent'
            ? new ParentDashboardService(config.iframe)
            : new IframeDashboardService(config.target);
    }
}

export default PlaceData;


