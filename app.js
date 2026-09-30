/*
=========================================================
CONCILIACIÓN WE CAPITAL
=========================================================

Este archivo controla:

- Importación del CSV
- Lectura de los movimientos
- Normalización de datos
- Filtros
- Agrupación por cuenta
- Agrupación por cliente
- Detalle por cliente
- Métricas
- Exportación

No utiliza backend.
Todo se ejecuta en el navegador.
*/


/* =====================================================
   ESTADO GLOBAL
===================================================== */

const state = {

  rows: [],

  filtered: [],

  headers: [],

  fileName: ""

};


/* =====================================================
   FUNCIONES GENERALES
===================================================== */

const $ = selector =>
  document.querySelector(selector);


const money = value => {

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(Number(value) || 0);

};


const esc = value => {

  return String(value ?? "")
    .replace(/[&<>"']/g, character => {

      const entities = {

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

      };

      return entities[character];

    });

};


/* =====================================================
   NOMBRES DE COLUMNAS
===================================================== */

const aliases = {

  journal: [
    "Journal No.",
    "Journal No",
    "Journal Number"
  ],

  date: [
    "Journal Date",
    "Date",
    "Transaction Date"
  ],

  invoice: [
    "Invoice",
    "Invoice No.",
    "Invoice Number"
  ],

  account: [
    "Account",
    "Account Name"
  ],

  debit: [
    "Debit",
    "Debits"
  ],

  credit: [
    "Credit",
    "Credits"
  ],

  description: [
    "Description",
    "Memo"
  ],

  name: [
    "Name",
    "Customer",
    "Vendor"
  ],

  client: [
    "Client",
    "Client Name"
  ],

  broker: [
    "Broker",
    "Broker Name"
  ],

  payment: [
    "Payment Method",
    "Payment"
  ],

  processed: [
    "Processed At",
    "Processed"
  ],

  batch: [
    "Batch ID",
    "Batch"
  ]

};


/* =====================================================
   PARSER CSV
===================================================== */

function parseCSV(text) {

  const output = [];

  let row = [];

  let field = "";

  let quoted = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const character = text[i];

    const nextCharacter = text[i + 1];


    /*
    Manejo de comillas
    */

    if (character === '"') {

      if (
        quoted &&
        nextCharacter === '"'
      ) {

        field += '"';

        i++;

      } else {

        quoted = !quoted;

      }

    }


    /*
    Separador
    */

    else if (
      character === "," &&
      !quoted
    ) {

      row.push(field);

      field = "";

    }


    /*
    Fin de línea
    */

    else if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !quoted
    ) {

      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {

        i++;

      }


      row.push(field);

      field = "";


      if (
        row.some(
          value => value.trim() !== ""
        )
      ) {

        output.push(row);

      }


      row = [];

    }


    else {

      field += character;

    }

  }


  /*
  Última fila
  */

  if (
    field !== "" ||
    row.length
  ) {

    row.push(field);


    if (
      row.some(
        value => value.trim() !== ""
      )
    ) {

      output.push(row);

    }

  }


  return output;

}


/* =====================================================
   CONVERSIÓN NUMÉRICA
===================================================== */

function numberValue(value) {

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {

    return 0;

  }


  let number = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[$€]/g, "");


  /*
  Formato:

  2.400,00

  */

  if (
    number.includes(".") &&
    number.includes(",")
  ) {

    number = number
      .replace(/\./g, "")
      .replace(",", ".");

  }


  /*
  Formato:

  2,400
  */

  else if (
    number.includes(",")
  ) {

    number = number
      .replace(",", ".");

  }


  const parsed = Number(
    number.replace(/[^\d.-]/g, "")
  );


  return Number.isFinite(parsed)
    ? parsed
    : 0;

}


/* =====================================================
   BUSCAR CAMPO
===================================================== */

function field(raw, type) {

  const keys = Object.keys(raw);


  const target = aliases[type].find(
    alias => {

      return keys.some(
        key =>
          key.trim().toLowerCase() ===
          alias.toLowerCase()
      );

    }
  );


  if (!target) {

    return "";

  }


  const key = keys.find(
    key =>
      key.trim().toLowerCase() ===
      target.toLowerCase()
  );


  return raw[key] ?? "";

}


/* =====================================================
   NORMALIZAR DATOS
===================================================== */

function normalize(headers, matrix) {

  return matrix.map(row => {

    const raw = {};


    headers.forEach(
      (header, index) => {

        raw[header] =
          (row[index] ?? "").trim();

      }
    );


    return {

      raw,

      journal:
        String(
          field(raw, "journal")
        ).trim(),

      date:
        String(
          field(raw, "date")
        ).trim(),

      invoice:
        String(
          field(raw, "invoice")
        ).trim(),

      account:
        String(
          field(raw, "account")
        ).trim() ||
        "Sin cuenta",

      debit:
        numberValue(
          field(raw, "debit")
        ),

      credit:
        numberValue(
          field(raw, "credit")
        ),

      description:
        String(
          field(raw, "description")
        ).trim(),

      name:
        String(
          field(raw, "name")
        ).trim(),

      client:
        String(
          field(raw, "client")
        ).trim() ||

        String(
          field(raw, "name")
        ).trim() ||

        "Sin cliente",

      broker:
        String(
          field(raw, "broker")
        ).trim() ||

        "Sin broker",

      payment:
        String(
          field(raw, "payment")
        ).trim(),

      processed:
        String(
          field(raw, "processed")
        ).trim(),

      batch:
        String(
          field(raw, "batch")
        ).trim()

    };

  });

}


/* =====================================================
   VALORES ÚNICOS
===================================================== */

function unique(values) {

  return [

    ...new Set(
      values.filter(Boolean)
    )

  ].sort(
    (a, b) =>
      a.localeCompare(b)
  );

}


/* =====================================================
   FILTROS
===================================================== */

function populateFilters() {

  const addOptions = (
    selector,
    values,
    label
  ) => {

    $(selector).innerHTML =

      `<option value="">
        ${label}
      </option>` +

      unique(values)

        .map(
          value =>
            `<option value="${esc(value)}">
              ${esc(value)}
            </option>`
        )

        .join("");

  };


  addOptions(
    "#accountFilter",
    state.rows.map(
      row => row.account
    ),
    "Cuenta"
  );


  addOptions(
    "#clientFilter",
    state.rows.map(
      row => row.client
    ),
    "Cliente"
  );


  addOptions(
    "#brokerFilter",
    state.rows.map(
      row => row.broker
    ),
    "Broker"
  );

}


/* =====================================================
   APLICAR FILTROS
===================================================== */

function applyFilters() {

  const search =
    $("#search")
      .value
      .trim()
      .toLowerCase();


  const account =
    $("#accountFilter").value;


  const client =
    $("#clientFilter").value;


  const broker =
    $("#brokerFilter").value;


  state.filtered =
    state.rows.filter(row => {

      const searchable = [

        row.journal,

        row.invoice,

        row.account,

        row.client,

        row.broker,

        row.name,

        row.description,

        row.batch

      ]
        .join(" ")
        .toLowerCase();


      return (

        (!search ||
          searchable.includes(search))

        &&

        (!account ||
          row.account === account)

        &&

        (!client ||
          row.client === client)

        &&

        (!broker ||
          row.broker === broker)

      );

    });


  render();

}


/* =====================================================
   RENDER PRINCIPAL
===================================================== */

function render() {

  const rows =
    state.filtered;


  const debit =
    rows.reduce(
      (sum, row) =>
        sum + row.debit,
      0
    );


  const credit =
    rows.reduce(
      (sum, row) =>
        sum + row.credit,
      0
    );


  const difference =
    debit - credit;


  $("#metricRows")
    .textContent =
      rows.length.toLocaleString();


  $("#metricInvoices")
    .textContent =
      `${new Set(
        rows
          .map(row => row.invoice)
          .filter(Boolean)
      ).size.toLocaleString()} invoices`;


  $("#metricDebit")
    .textContent =
      money(debit);


  $("#metricCredit")
    .textContent =
      money(credit);


  $("#metricDiff")
    .textContent =
      money(difference);


  renderAccounts();

  renderAccountTable();

  renderTransactions();

}


/* =====================================================
   AGRUPAR
===================================================== */

function group(rows, key) {

  const map = new Map();


  rows.forEach(row => {

    if (!map.has(row[key])) {

      map.set(
        row[key],
        []
      );

    }


    map
      .get(row[key])
      .push(row);

  });


  return map;

}


/* =====================================================
   CUENTAS
===================================================== */

function renderAccounts() {

  const groups =
    group(
      state.filtered,
      "account"
    );


  $("#accountList").innerHTML =

    [...groups.entries()]

      .sort(
        (a, b) =>
          a[0].localeCompare(b[0])
      )

      .map(
        ([account, rows]) => {

          const debit =
            rows.reduce(
              (sum, row) =>
                sum + row.debit,
              0
            );


          const credit =
            rows.reduce(
              (sum, row) =>
                sum + row.credit,
              0
            );


          const clients =
            group(
              rows,
              "client"
            );


          const clientHTML =

            [...clients.entries()]

              .sort(
                (a, b) =>
                  a[0].localeCompare(b[0])
              )

              .map(
                ([client, clientRows]) => {

                  const clientDebit =
                    clientRows.reduce(
                      (sum, row) =>
                        sum + row.debit,
                      0
                    );


                  const clientCredit =
                    clientRows.reduce(
                      (sum, row) =>
                        sum + row.credit,
                      0
                    );


                  const brokers =
                    unique(
                      clientRows.map(
                        row => row.broker
                      )
                    ).join(" · ");


                  return `

                    <div
                      class="client-line"
                      data-account="${esc(account)}"
                      data-client="${esc(client)}"
                    >

                      <div>

                        <div class="client-name">
                          ${esc(client)}
                        </div>

                        <div class="client-meta">
                          ${esc(
                            brokers ||
                            "Sin broker"
                          )}

                          ·

                          ${clientRows.length}
                          movimientos
                        </div>

                      </div>


                      <div class="client-col">

                        <span class="cell-label">
                          Débitos
                        </span>

                        <span class="cell-value">
                          ${money(clientDebit)}
                        </span>

                      </div>


                      <div class="client-col">

                        <span class="cell-label">
                          Créditos
                        </span>

                        <span class="cell-value">
                          ${money(clientCredit)}
                        </span>

                      </div>


                      <div class="client-col">

                        <span class="cell-label">
                          Movimientos
                        </span>

                        <span class="cell-value">
                          ${clientRows.length}
                        </span>

                      </div>


                      <div class="client-arrow">
                        ›
                      </div>

                    </div>

                  `;

                }
              )

              .join("");


          return `

            <article class="account-row">


              <div class="account-main">


                <div>

                  <div class="account-name">
                    ${esc(account)}
                  </div>

                  <span class="account-sub">
                    ${clients.size}
                    clientes ·
                    ${rows.length}
                    movimientos
                  </span>

                </div>


                <div class="metric-col">

                  <span class="cell-label">
                    Débitos
                  </span>

                  <span class="cell-value">
                    ${money(debit)}
                  </span>

                </div>


                <div class="metric-col">

                  <span class="cell-label">
                    Créditos
                  </span>

                  <span class="cell-value">
                    ${money(credit)}
                  </span>

                </div>


                <div class="metric-col">

                  <span class="cell-label">
                    Saldo
                  </span>

                  <span class="cell-value">
                    ${money(
                      debit - credit
                    )}
                  </span>

                </div>


                <div class="account-arrow">
                  ⌄
                </div>


              </div>


              <div class="account-detail">

                ${clientHTML}

              </div>


            </article>

          `;

        }
      )

      .join("");


  /*
  Abrir / cerrar cuenta
  */

  document
    .querySelectorAll(".account-main")
    .forEach(element => {

      element.addEventListener(
        "click",
        () => {

          element
            .parentElement
            .classList
            .toggle("open");

        }
      );

    });


  /*
  Abrir detalle del cliente
  */

  document
    .querySelectorAll(".client-line")
    .forEach(element => {

      element.addEventListener(
        "click",
        () => {

          openDrawer(
            element.dataset.account,
            element.dataset.client
          );

        }
      );

    });

}


/* =====================================================
   TABLA DE CUENTAS
===================================================== */

function renderAccountTable() {

  const groups =
    group(
      state.filtered,
      "account"
    );


  const rows =

    [...groups.entries()]

      .sort(
        (a, b) =>
          a[0].localeCompare(b[0])
      )

      .map(
        ([account, accountRows]) => {

          const debit =
            accountRows.reduce(
              (sum, row) =>
                sum + row.debit,
              0
            );


          const credit =
            accountRows.reduce(
              (sum, row) =>
                sum + row.credit,
              0
            );


          return {

            account,

            count:
              accountRows.length,

            clients:
              new Set(
                accountRows.map(
                  row => row.client
                )
              ).size,

            brokers:
              new Set(
                accountRows
                  .map(
                    row => row.broker
                  )
                  .filter(Boolean)
              ).size,

            debit,

            credit,

            balance:
              debit - credit

          };

        }
      );


  $("#accountsTable").innerHTML = `

    <table class="data-table">

      <thead>

        <tr>

          <th>Cuenta</th>

          <th>Movimientos</th>

          <th>Clientes</th>

          <th>Brokers</th>

          <th>Débitos</th>

          <th>Créditos</th>

          <th>Saldo</th>

        </tr>

      </thead>


      <tbody>

        ${rows.map(row => `

          <tr>

            <td>
              <b>
                ${esc(row.account)}
              </b>
            </td>

            <td>
              ${row.count}
            </td>

            <td>
              ${row.clients}
            </td>

            <td>
              ${row.brokers}
            </td>

            <td class="num">
              ${money(row.debit)}
            </td>

            <td class="num">
              ${money(row.credit)}
            </td>

            <td class="num balance">
              ${money(row.balance)}
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>

  `;

}


/* =====================================================
   TABLA DE MOVIMIENTOS
===================================================== */

function tableHTML(rows) {

  return `

    <table class="data-table">

      <thead>

        <tr>

          <th>Fecha</th>

          <th>Invoice</th>

          <th>Cuenta</th>

          <th>Cliente</th>

          <th>Broker</th>

          <th>Débito</th>

          <th>Crédito</th>

          <th>Journal</th>

        </tr>

      </thead>


      <tbody>

        ${rows.map(row => `

          <tr>

            <td>
              ${esc(row.date)}
            </td>

            <td>
              ${esc(row.invoice)}
            </td>

            <td>
              ${esc(row.account)}
            </td>

            <td>
              ${esc(row.client)}
            </td>

            <td>
              ${esc(row.broker)}
            </td>

            <td class="num">
              ${money(row.debit)}
            </td>

            <td class="num">
              ${money(row.credit)}
            </td>

            <td>
              ${esc(row.journal)}
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>

  `;

}


/* =====================================================
   MOVIMIENTOS
===================================================== */

function renderTransactions() {

  $("#transactionsTable")
    .innerHTML =
      tableHTML(
        state.filtered
      );

}


/* =====================================================
   DRAWER
===================================================== */

function openDrawer(
  account,
  client
) {

  const rows =
    state.filtered.filter(
      row =>
        row.account === account &&
        row.client === client
    );


  const debit =
    rows.reduce(
      (sum, row) =>
        sum + row.debit,
      0
    );


  const credit =
    rows.reduce(
      (sum, row) =>
        sum + row.credit,
      0
    );


  $("#drawerTitle")
    .textContent =
      client;


  $("#drawerMeta")
    .innerHTML = `

      <div>

        <span>
          Cuenta
        </span>

        <strong>
          ${esc(account)}
        </strong>

      </div>


      <div>

        <span>
          Débitos
        </span>

        <strong>
          ${money(debit)}
        </strong>

      </div>


      <div>

        <span>
          Créditos
        </span>

        <strong>
          ${money(credit)}
        </strong>

      </div>


      <div>

        <span>
          Movimientos
        </span>

        <strong>
          ${rows.length}
        </strong>

      </div>

    `;


  $("#drawerTable")
    .innerHTML =
      tableHTML(rows);


  $("#drawer")
    .classList
    .remove("hidden");

}


/* =====================================================
   EXPORTAR
===================================================== */

function csvEscape(value) {

  return `"${String(
    value ?? ""
  ).replace(
    /"/g,
    '""'
  )}"`;

}


function exportRows(
  rows,
  fileName
) {

  if (!rows.length) {

    return;

  }


  const columns = [

    "Journal No.",
    "Journal Date",
    "Invoice",
    "Account",
    "Debit",
    "Credit",
    "Description",
    "Name",
    "Client",
    "Broker",
    "Payment Method",
    "Processed At",
    "Batch ID"

  ];


  const lines = [

    columns
      .map(csvEscape)
      .join(",")

  ];


  rows.forEach(row => {

    lines.push(

      [

        row.journal,
        row.date,
        row.invoice,
        row.account,
        row.debit || "",
        row.credit || "",
        row.description,
        row.name,
        row.client,
        row.broker,
        row.payment,
        row.processed,
        row.batch

      ]

        .map(csvEscape)

        .join(",")

    );

  });


  const blob = new Blob(

    [
      "\ufeff" +
      lines.join("\r\n")
    ],

    {
      type:
        "text/csv;charset=utf-8"
    }

  );


  const link =
    document.createElement("a");


  link.href =
    URL.createObjectURL(blob);


  link.download =
    fileName;


  link.click();


  URL.revokeObjectURL(
    link.href
  );

}


/* =====================================================
   IMPORTAR ARCHIVO
===================================================== */

function loadFile(file) {

  const reader =
    new FileReader();


  reader.onload = () => {

    const matrix =
      parseCSV(
        reader.result
      );


    if (!matrix.length) {

      alert(
        "El archivo no contiene información."
      );

      return;

    }


    const headers =
      matrix
        .shift()
        .map(
          value =>
            value.trim()
        );


    state.headers =
      headers;


    state.rows =
      normalize(
        headers,
        matrix
      );


    state.filtered =
      [...state.rows];


    state.fileName =
      file.name;


    $("#fileLabel")
      .textContent =
      file.name;


    $("#emptyView")
      .classList
      .add("hidden");


    $("#dataView")
      .classList
      .remove("hidden");


    populateFilters();

    applyFilters();

  };


  reader.readAsText(
    file,
    "UTF-8"
  );

}


/* =====================================================
   IMPORTADORES
===================================================== */

$("#fileInput")
  .addEventListener(
    "change",
    event => {

      if (
        event.target.files[0]
      ) {

        loadFile(
          event.target.files[0]
        );

      }

    }
  );


$("#emptyFileInput")
  .addEventListener(
    "change",
    event => {

      if (
        event.target.files[0]
      ) {

        loadFile(
          event.target.files[0]
        );

      }

    }
  );


/* =====================================================
   FILTROS
===================================================== */

[
  "search",
  "accountFilter",
  "clientFilter",
  "brokerFilter"

].forEach(id => {

  $("#" + id)
    .addEventListener(
      "input",
      applyFilters
    );

});


$("#resetFilters")
  .addEventListener(
    "click",
    () => {

      [

        "search",
        "accountFilter",
        "clientFilter",
        "brokerFilter"

      ].forEach(id => {

        $("#" + id).value = "";

      });


      applyFilters();

    }
  );


/* =====================================================
   EXPORTACIONES
===================================================== */

$("#exportButton")
  .addEventListener(
    "click",
    () => {

      exportRows(
        state.filtered,
        "conciliacion_we_capital_filtrado.csv"
      );

    }
  );


$("#exportTransactions")
  .addEventListener(
    "click",
    () => {

      exportRows(
        state.filtered,
        "conciliacion_we_capital_movimientos.csv"
      );

    }
  );


/* =====================================================
   DRAWER
===================================================== */

$("#closeDrawer")
  .addEventListener(
    "click",
    () => {

      $("#drawer")
        .classList
        .add("hidden");

    }
  );


$(".drawer-backdrop")
  .addEventListener(
    "click",
    () => {

      $("#drawer")
        .classList
        .add("hidden");

    }
  );


/* =====================================================
   NAVEGACIÓN
===================================================== */

document
  .querySelectorAll(".nav-link")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".nav-link"
          )
          .forEach(
            item =>
              item.classList
                .remove("active")
          );


        button.classList
          .add("active");


        $("#dataView")
          .classList
          .toggle(
            "hidden",
            button.dataset.view !==
              "overview"
          );


        $("#accountsView")
          .classList
          .toggle(
            "hidden",
            button.dataset.view !==
              "accounts"
          );


        $("#transactionsView")
          .classList
          .toggle(
            "hidden",
            button.dataset.view !==
              "transactions"
          );

      }
    );

  });


