// ==================================================================
// Módulo: utils.js
// Responsabilidade: Funções de utilidade "puras" (formatação, máscaras, cálculos).
// ==================================================================

/**
 * Aplica a máscara de CNPJ a um campo de input.
 * @param {HTMLInputElement} input O elemento do formulário.
 */
export function maskCNPJ(input) {
  let value = input.value.replace(/\D/g, "").substring(0, 14);
  value = value.replace(/^(\d{2})(\d)/, "$1.$2");
  value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
  value = value.replace(/(\d{4})(\d)/, "$1-$2");
  input.value = value;
}

/**
 * Formata um CNPJ numérico (string de 14 dígitos) para exibição.
 * @param {string} cnpj A string de 14 dígitos.
 * @returns {string} O CNPJ formatado.
 */
export function formatCNPJForDisplay(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj;
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Aplica a máscara de número de processo a um campo de input.
 * @param {HTMLInputElement} input O elemento do formulário.
 */
export function maskProcesso(input) {
  let v = input.value.replace(/\D/g, "").substring(0, 20);
  if (v.length > 16) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(
      13,
      14
    )}.${v.slice(14, 16)}.${v.slice(16, 20)}`;
  } else if (v.length > 14) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(
      13,
      14
    )}.${v.slice(14, 16)}`;
  } else if (v.length > 13) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(
      13,
      14
    )}`;
  } else if (v.length > 9) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}`;
  } else if (v.length > 7) {
    v = `${v.slice(0, 7)}-${v.slice(7, 9)}`;
  }
  input.value = v;
}

/**
 * Formata um número de processo numérico (string de 20 dígitos) para exibição.
 * @param {string} numero A string de 20 dígitos.
 * @returns {string} O número do processo formatado.
 */
export function formatProcessoForDisplay(numero) {
  if (!numero || numero.length !== 20) return numero;
  return numero.replace(
    /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
    "$1-$2.$3.$4.$5.$6"
  );
}

/**
 * Formata um número para o padrão de moeda brasileira (BRL).
 * @param {number} value O valor numérico.
 * @returns {string} O valor formatado como moeda.
 */
export function formatCurrency(value) {
  if (typeof value !== "number") return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Calcula o status da análise de um devedor com base na data da última análise e nível de prioridade.
 * @param {object} devedor O objeto do devedor.
 * @returns {{status: string, text: string}} Objeto com a classe CSS e o texto do status.
 */
export function getAnaliseStatus(devedor) {
  const zerarHora = (data) => {
    data.setHours(0, 0, 0, 0);
    return data;
  };

  const hoje = zerarHora(new Date());

  if (!devedor.dataUltimaAnalise) {
    if (devedor.criadoEm) {
      const dataCriacao = zerarHora(devedor.criadoEm.toDate());
      const diffTime = hoje - dataCriacao;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const plural = diffDays === 1 ? "dia" : "dias";

      if (diffDays <= 0) {
        return { status: "status-expired", text: "Pendente (hoje)" };
      }
      return {
        status: "status-expired",
        text: `Pendente há ${diffDays} ${plural}`,
      };
    }
    return { status: "status-expired", text: "Pendente" };
  }

  const prazos = { 1: 30, 2: 45, 3: 60 };
  const prazoDias = prazos[devedor.nivelPrioridade];

  const dataUltima = zerarHora(devedor.dataUltimaAnalise.toDate());
  const dataVencimento = new Date(dataUltima);
  dataVencimento.setDate(dataVencimento.getDate() + prazoDias);

  const diffTime = dataVencimento - hoje;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const diasVencidos = Math.abs(diffDays);
    const pluralVencido = diasVencidos === 1 ? "dia" : "dias";
    return {
      status: "status-expired",
      text: `Vencido há ${diasVencidos} ${pluralVencido}`,
    };
  }

  if (diffDays === 0) {
    return { status: "status-warning", text: `Vence hoje` };
  }

  const pluralVence = diffDays === 1 ? "dia" : "dias";
  if (diffDays <= 7) {
    return {
      status: "status-warning",
      text: `Vence em ${diffDays} ${pluralVence}`,
    };
  }

  return { status: "status-ok", text: `Vence em ${diffDays} ${pluralVence}` };
}

/**
 * Aplica máscara de CPF ou CNPJ a um campo de input, dependendo do tipo de pessoa.
 * @param {HTMLInputElement} input O elemento do formulário.
 * @param {'fisica' | 'juridica'} tipoPessoa O tipo de pessoa.
 */
export function maskDocument(input, tipoPessoa) {
  let value = input.value.replace(/\D/g, "");
  if (tipoPessoa === "juridica") {
    value = value.substring(0, 14);
    value = value.replace(/^(\d{2})(\d)/, "$1.$2");
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
    value = value.replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    value = value.substring(0, 11);
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  input.value = value;
}

/**
 * Formata um CPF ou CNPJ numérico para exibição.
 * @param {string} doc A string de 11 (CPF) ou 14 (CNPJ) dígitos.
 * @returns {string} O documento formatado.
 */
export function formatDocumentForDisplay(doc) {
  if (!doc) return "Não informado";
  doc = doc.replace(/\D/g, "");
  if (doc.length === 11) {
    return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (doc.length === 14) {
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}
