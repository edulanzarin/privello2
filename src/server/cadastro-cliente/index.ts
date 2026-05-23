/**
 * Sistema_de_Cadastro_Cliente — barrel de exportações.
 *
 * Concentra a API pública do serviço de cadastro de Cliente
 * (Requirement 2). Consumidores devem importar daqui em vez de tocar
 * arquivos internos.
 */

export {
    registrar,
    type CadastroClienteInput,
    type CadastroClienteResult,
    type CadastroClienteFailureReason,
} from "./registrar";
