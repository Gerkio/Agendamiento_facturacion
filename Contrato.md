---

# CONTRATO DE DESARROLLO DE SOFTWARE A MEDIDA Y LICENCIAMIENTO DE USO PERPETUO

**ENTRE LOS SUSCRITOS:**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**, mayor de edad, domiciliado(a) en la ciudad de \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_, identificado(a) con la Cédula de Ciudadanía No. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_, actuando en nombre y representación legal de **ASEO Y CONFORT GROUP S.A.S.**, sociedad comercial legalmente constituida, identificada con NIT. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_, calidad que se acredita mediante el certificado de existencia y representación legal de la Cámara de Comercio respectiva, contribuyente perteneciente al **Régimen Simple de Tributación (RST)**, quien para efectos del presente contrato se denominará **EL CONTRATANTE**; y

**SERGIO VALENCIA GALLEGO**, mayor de edad, domiciliado en la ciudad de Medellín, identificado con la Cédula de Ciudadanía No. 1.152.209.473, actuando en nombre propio, registrado en el RUT como **Persona Natural No Responsable de IVA**, quien para efectos de este instrumento se denominará **EL DESARROLLADOR**,

Quienes conjuntamente se denominarán **LAS PARTES**, hemos convenido celebrar el presente *Contrato de Desarrollo de Software a Medida y Licenciamiento de Uso Perpetuo*, el cual se regirá por las cláusulas que a continuación se detallan, previo a las siguientes:

### CONSIDERACIONES:

* **Primera:** Que **EL CONTRATANTE** requiere de un sistema informático interno y a medida para optimizar la asignación de turnos de su personal de aseo, gestionar su base de datos operativa y resolver de forma directa su facturación electrónica ante la Dirección de Impuestos y Aduanas Nacionales (DIAN) bajo el estándar de transmisión vigente.  
* **Segunda:** Que **EL DESARROLLADOR** es un ingeniero y desarrollador de software independiente con experiencia técnica especializada en la arquitectura de software, bases de datos relacionales y conexiones fiscales bajo el estándar UBL 2.1 exigido por la DIAN, por lo que cuenta con la idoneidad y capacidad técnica para ejecutar dicho encargo de forma autónoma.  
* **Tercera:** Que **LAS PARTES** acuerdan que este proyecto se ejecuta bajo el principio de conservación de los derechos de propiedad intelectual en cabeza del creador, otorgando exclusivamente una licencia de explotación de uso comercial interno a favor de **EL CONTRATANTE**, sin que ello implique transferencia o cesión patrimonial alguna sobre el código fuente original ni sobre el núcleo de facturación directa.

\---

### CLÁUSULAS:

#### CLÁUSULA PRIMERA: OBJETO

El presente contrato tiene por objeto la prestación de servicios de ingeniería de software independientes por parte de **EL DESARROLLADOR** para el diseño, codificación, pruebas de conectividad e implementación de una plataforma interna de agendamiento y facturación electrónica directa para **EL CONTRATANTE**, de conformidad con las especificaciones técnicas delimitadas en la Cláusula Segunda.

#### CLÁUSULA SEGUNDA: ALCANCE DEL TRABAJO, ENTREGABLES Y DEFINICIÓN DEL MVP

**EL DESARROLLADOR** ejecutará el proyecto estructurándolo en un MVP funcional, estable y desplegable, orientado a cubrir los procesos operativos esenciales de agendamiento, control de personal, administración de operaciones y facturación electrónica directa para uso interno de **EL CONTRATANTE**. El alcance del MVP incluirá, además de los módulos básicos de arranque, las funcionalidades que ya forman parte de la arquitectura del sistema y que se detallan a continuación:

1. **Módulo de Directorio Operativo (CRUD) y Migración Inicial:** Creación y administración de registros de clientes, empleadas de aseo, usuarios internos y otros actores operativos del negocio. Incluye la estructura relacional en entorno cloud, la migración inicial de datos históricos a partir del archivo plano o tabla suministrada por **EL CONTRATANTE** y la validación básica de información.  
2. **Calendario Interactivo de Servicios con Alertas Manuales:** Panel visual de administración para programar servicios individuales y recurrentes, gestionar turnos, estados de servicio, horarios, clientes, trabajadoras y reprogramaciones. El sistema emitirá alertas visuales cuando detecte conflictos, cruces de horario o asignaciones que requieran revisión por parte del administrador.  
3. **Gestión de Catálogo de Servicios y Parámetros Operativos:** Definición de tipos de servicio, tarifas, condiciones operativas, formas de pago y reglas básicas para la asignación y facturación de los trabajos realizados.  
4. **Interfaz de Consulta para Personal Operativo:** Acceso web seguro para que el personal operativo consulte su agenda diaria o semanal desde un dispositivo móvil o computador, en modalidad de lectura y con control de acceso por rol.  
5. **Módulo de Facturación Nativa DIAN y Notas Crédito:** Generación de facturas de venta a partir de los servicios realizados y aprobados, cálculo de valores e impuestos, preparación del XML UBL 2.1, cálculo del CUFE o identificador equivalente, firma electrónica y transmisión directa vía Web Services SOAP a la DIAN. También incluirá la posibilidad de emitir notas crédito o ajustes cuando la operación así lo requiera.  
6. **Panel de Control y KPIs Operativos:** Dashboard interno con indicadores básicos de actividad, ingresos del período, servicios pendientes, servicios del día, borradores por enviar, novedades pendientes y estado general del negocio.  
7. **Módulos Complementarios de Operación y Seguimiento:** Gestión de novedades, peticiones, PQR, gastos, cuentas por cobrar, recibos, reportes básicos y otros módulos transversales previstos en la arquitectura de la plataforma para apoyar la administración diaria.  
8. **Seguridad, Autenticación y Auditoría Básica:** Registro y administración de usuarios con roles, autenticación segura, recuperación de credenciales, control de acceso, trazabilidad de acciones y bitácora básica para soporte técnico y operación.  
9. **Despliegue, Documentación y Puesta en Marcha Inicial:** Implementación del sistema en un entorno funcional en producción o en entorno de validación autorizado por **EL CONTRATANTE**, configuración básica de variables de entorno, conexión a la base de datos, documentación técnica mínima y soporte inicial para validar el flujo completo.  
10. **Criterios de Aceptación del MVP:** Se entenderá entregado a satisfacción cuando el sistema permita crear y consultar clientes y trabajadoras, programar servicios, visualizar turnos para el personal operativo, generar facturas electrónicas y dejar el flujo de facturación listo para su envío al proceso DIAN desde la plataforma.

La ausencia de alguna funcionalidad adicional no prevista en este apartado no se interpretará como incumplimiento del contrato, siempre que el MVP descrito en esta cláusula haya sido entregado de forma funcional, estable y operativa.

#### CLÁUSULA TERCERA: VALOR, FORMA DE PAGO Y DECLARACIÓN TRIBUTARIA

1. **Valor Total:** El valor total acordado por el diseño, desarrollo, pruebas de conexión fiscal e implementación de la plataforma descrita es de **DOS MILLONES QUINIENTOS MIL PESOS M/CTE ($2.500.000 COP)**. Este valor es neto y libre de IVA, atendiendo la calidad de No Responsable de IVA de **EL DESARROLLADOR**.  
2. **Forma de Pago:**  
* **Anticipo del Treinta Por Ciento (30%)**, equivalente a **SETECIENTOS CINCUENTA MIL PESOS M/CTE ($750.000 COP):** Pagaderos de forma previa al inicio de cualquier actividad de desarrollo. Este rubro tiene como finalidad reservar la disponibilidad de ingeniería del desarrollador y formalizar el inicio del cronograma, por lo que no estará sujeto a devoluciones una vez iniciadas las actividades técnicas.  
* **Saldo del Setenta Por Ciento (70%)**, equivalente a **UN MILLÓN SETECIENTOS CINCUENTA MIL PESOS M/CTE ($1.750.000 COP):** Cancelados contra entrega a entera satisfacción de **EL CONTRATANTE**, una vez el software se encuentre desplegado en el entorno de producción, con los datos históricos migrados y las pruebas de transmisión validadas, sujeto a los parágrafos de esta cláusula.  
3. **Soporte y Tratamiento Tributario (DIAN):**  
     
* Al ser **EL DESARROLLADOR** una persona natural no obligada a facturar y **EL CONTRATANTE** un contribuyente del **Régimen Simple de Tributación (RST)**, para efectos de soportar legalmente el costo y gasto ante la DIAN, **EL CONTRATANTE** deberá emitir de forma obligatoria el *Documento Soporte en Adquisiciones Efectuadas a Sujetos No Obligados a Expedir Factura de Venta o Documento Equivalente* en formato electrónico, conforme a las resoluciones vigentes de la DIAN.  
    
* De conformidad con el artículo 911 del Estatuto Tributario, al pertenecer **EL CONTRATANTE** al Régimen Simple de Tributación (RST), este no tiene la calidad de agente retenedor de impuesto sobre la renta respecto a los pagos efectuados a terceros independientes en compras de servicios, razón por la cual **no se practicará ningún tipo de retención en la fuente a título de renta** sobre los pagos de este contrato.  
    
* **PARÁGRAFO PRIMERO (INDEPENDENCIA DE AMBIENTES FISCALES DIAN):** Se entenderá cumplido el hito técnico para la liberación del saldo del setenta por ciento (70%) una vez **EL DESARROLLADOR** demuestre mediante bitácoras de error o logs del sistema que los módulos de software están listos para empaquetar la estructura XML UBL 2.1 y realizar el llamado al Web Service de la DIAN de manera correcta. Si la habilitación final en producción o la ejecución del "Set de Pruebas" ante la DIAN se retrasa o imposibilita debido a intermitencias, fallas generalizadas, actualizaciones de la plataforma informática de la DIAN, o por la falta de un Certificado Digital válido y vigente a nombre de **EL CONTRATANTE**, dicho retraso no será imputable a **EL DESARROLLADOR**, procediendo la obligación de pago del saldo dentro de los tres (3) días siguientes a la demostración de conectividad técnica.  
    
* **PARÁGRAFO SEGUNDO (CERTIFICADO DE FIRMA DIGITAL):** Es responsabilidad exclusiva y a expensas de **EL CONTRATANTE** la adquisición, vigencia y entrega oportuna de las credenciales y el Certificado Digital de Firma Electrónica (.p12 o .pfx) emitido por una Entidad de Certificación Abierta autorizada en Colombia por la ONAC. Las demoras en la entrega de este insumo activarán los sobrecostos estipulados en la Cláusula Cuarta.

#### CLÁUSULA CUARTA: PLAZO, CORRESPONSABILIDAD Y EXTENSIONES

1. **Plazo de Ejecución:** El plazo estimado para la entrega del MVP en producción es de treinta (30) días calendario, contados a partir del pago del anticipo y la entrega de los accesos técnicos iniciales.  
2. **Corresponsabilidad en el Feedback Rápido:** El modelo de desarrollo requiere comunicación ágil. **EL CONTRATANTE** se obliga a entregar revisiones, textos, aprobaciones de diseño o accesos técnicos solicitados en un plazo máximo de veinticuatro (24) horas hábiles. Cualquier demora por parte de **EL CONTRATANTE** suspenderá el término de los 30 días y extenderá automáticamente el plazo de entrega por el mismo tiempo de retraso.  
3. **Umbral de Tolerancia y Cláusula Moratoria de Disponibilidad:** Se pacta un umbral de tolerancia mutuo de siete (7) días calendario adicionales sobre el tiempo estimado para cubrir imprevistos técnicos. Transcurrido el día treinta y siete (37), si el proyecto no se ha culminado por causas imputables exclusivamente a **EL CONTRATANTE** (retrasos en la entrega de bases de datos limpias, demoras en el trámite de firmas, omisión de respuestas), se generará a favor de **EL DESARROLLADOR** un sobrecosto compensatorio por mantenimiento de disponibilidad de ingeniería equivalente al quince por ciento (15%) semanal del valor total del contrato ($375.000 COP por semana de retraso).

#### CLÁUSULA QUINTA: PROPIEDAD INTELECTUAL, LICENCIA Y CONTROL DEL REPOSITORIO

1. **Titularidad de los Derechos:** De conformidad con la Decisión Andina 351 de 1993 y la Ley 23 de 1982, la propiedad intelectual, los derechos morales de autor y los derechos patrimoniales sobre la arquitectura del software, la lógica algorítmica del calendario, y el núcleo informático de conexión directa con los Web Services de la DIAN pertenecen de forma exclusiva y en su totalidad a **EL DESARROLLADOR**. **EL DESARROLLADOR** se reserva expresamente el derecho de realizar forks (bifurcaciones), reutilizar o adaptar este código base para el desarrollo de soluciones similares a terceros en el futuro.  
2. **Licencia de Uso Condicionada:** Sujeto a la condición suspensiva del pago total y efectivo del cien por ciento (100%) de los honorarios pactados en la Cláusula Tercera, **EL DESARROLLADOR** otorgará a **EL CONTRATANTE** una *Licencia de Uso Perpetua, Privada y No Exclusiva*, limitada única y exclusivamente a la explotación operativa comercial interna de su negocio bajo la personería jurídica de ASEO Y CONFORT GROUP S.A.S. Se entiende que, en caso de mora o impago del saldo del setenta por ciento (70%), la licencia no nacerá a la vida jurídica, y cualquier uso, despliegue o explotación de la plataforma por parte de **EL CONTRATANTE** será considerado una infracción directa a los derechos de autor de conformidad con la Cláusula Sexta.  
3. **Control Técnico de Despliegue y Acceso al Repositorio (GitHub):**  
* **EL CONTRATANTE** tendrá el control administrativo y el acceso directo a los entornos de alojamiento y base de datos creados para el despliegue del proyecto en producción (cuentas de Vercel y Supabase).  
* No obstante, el código fuente original del proyecto estará enlazado y hospedado bajo una cuenta y repositorio de la plataforma GitHub propiedad de **EL DESARROLLADOR**.  
* **EL DESARROLLADOR** será el único y exclusivo administrador con acceso para manipular, actualizar, modificar o clonar el código en dicho repositorio de GitHub. **EL CONTRATANTE** acepta expresamente que no tendrá derechos de acceso, edición, clonación ni modificación directa sobre el repositorio de GitHub de **EL DESARROLLADOR**.  
4. **Restricciones de Explotación:** Queda expresamente prohibido para **EL CONTRATANTE**, sus socios, empleados, contratistas o cualquier tercero vinculado, de forma directa o indirecta: revender, sublicenciar, distribuir, ceder, transferir, comercializar o prestar servicios de "software como servicio" (SaaS) a terceros utilizando la plataforma licenciada, así como someterla a procesos de ingeniería inversa, desensamblaje o descompilación fuera de los límites autorizados por este instrumento.  
5. **Componentes de Terceros y Open Source:** **EL CONTRATANTE** reconoce y acepta que el software puede integrar librerías, dependencias y frameworks de terceros distribuidos bajo licencias de código abierto (MIT, Apache, GNU, etc.). La inclusión de estos elementos no afecta la validez de la Licencia de Uso Perpetuo del software global, ni transfiere la propiedad de dichas librerías a ninguna de las partes.

#### CLÁUSULA SEXTA: SANCIONES POR PIRATERÍA, USO INDEBIDO O BIFURCACIÓN NO AUTORIZADA

Cualquier intento o ejecución de un "fork" (bifurcación) del repositorio, copia no autorizada del código, desarrollo "encima" del software licenciado, modificación del código fuente sin autorización expresa por escrito de **EL DESARROLLADOR**, o distribución no permitida de la plataforma, será catalogada legalmente como una infracción grave a los derechos de propiedad intelectual, constituyendo actos de piratería de software y falsedad de conformidad con la Ley 23 de 1982, la Ley 44 de 1993, y la Decisión Andina 351 de 1993\. En tales eventos:

1. **EL DESARROLLADOR** asumirá la propiedad y total capacidad de disposición de forma automática y de pleno derecho sobre cualquier copia, bifurcación o desarrollo derivado ilegal que se hubiere generado.  
2. **EL CONTRATANTE** se obliga a pagar a **EL DESARROLLADOR**, a título de indemnización pre-estimada de perjuicios y sin perjuicio de las acciones penales y civiles que correspondan, una suma equivalente al cien por ciento (100%) del valor comercial de un desarrollo nuevo por cada copia o bifurcación no autorizada que se detecte o que se intente implementar. Este contrato prestará mérito ejecutivo para el cobro de esta obligación pecuniaria.

#### CLÁUSULA SÉPTIMA: TITULARIDAD DE LA INFRAESTRUCTURA CLOUD Y COSTOS DE TERCEROS

1. **Titularidad de Cuentas:** Todas las cuentas, suscripciones y entornos de servicios en la nube necesarios para el funcionamiento y despliegue del software (Vercel, Supabase u otros requeridos) serán creadas a nombre y bajo la exclusiva titularidad jurídica y económica de **EL CONTRATANTE**.  
2. **Asunción de Costos:** Aunque se prevé que el tamaño inicial del proyecto se mantenga dentro de los límites de los planes gratuitos de los proveedores de nube, de llegarse a generar algún cobro tarifario por almacenamiento, volumen de datos en base de datos, tráfico de red, APIs de terceros o actualización de planes, **dichos costos serán asumidos en su totalidad y de manera directa por EL CONTRATANTE**, quien deberá registrar su propio método de pago en las respectivas plataformas. **EL DESARROLLADOR** queda totalmente eximido de cualquier cobro, recargo o responsabilidad de pago derivada de la infraestructura de alojamiento o bases de datos del sistema.

#### CLÁUSULA OCTAVA: LIMITACIÓN DE RESPONSABILIDAD

1. **Cap General de Responsabilidad:** La responsabilidad civil contractual y extracontractual acumulada de **EL DESARROLLADOR** derivada de cualquier reclamación relacionada con este contrato, el software o su ejecución, estará limitada a una suma máxima equivalente al cien por ciento (100%) de los honorarios efectivamente percibidos por **EL DESARROLLADOR** bajo este contrato, esto es, hasta un tope máximo de **DOS MILLONES QUINIENTOS MIL PESOS M/CTE ($2.500.000 COP)**.  
2. **Exclusión de Perjuicios Consecuenciales y Lucro Cesante:** En ningún caso **EL DESARROLLADOR** será responsable ante **EL CONTRATANTE** o terceros por daños indirectos, especiales, consecuenciales, incidentales, punitivos, pérdida de datos, lucro cesante, interrupción del negocio o pérdidas económicas de cualquier índole derivadas del uso o de la imposibilidad de uso del software.  
3. **Exclusiones por Factores Externos:** **EL DESARROLLADOR** no asumirá responsabilidad civil, comercial o penal por la interrupción en los servicios de agendamiento o facturación debido a:  
* Fallas, caídas de red, mantenimiento programado o intermitencias en los Web Services de la DIAN.  
* Suspensiones de servicio, fallas físicas, pérdida de datos o ataques de seguridad en la infraestructura de Vercel, Supabase o proveedores cloud similares.  
* Problemas en el servicio de internet del contratante o defectos en sus dispositivos de hardware locales.

#### CLÁUSULA NOVENA: GARANTÍA TÉCNICA Y MANTENIMIENTO FUTURO

1. **Garantía Técnica:** El software objeto de este contrato cuenta con una garantía técnica única de quince (15) días calendario contados a partir de la entrega a satisfacción en el entorno de producción, orientada estrictamente a la corrección de errores de código de programación (bugs) atribuibles al desarrollo directo de **EL DESARROLLADOR**.  
2. **Soporte y Mantenimiento Post-Garantía:** Cualquier asistencia técnica, corrección de fallos por fuera del período de garantía, adición de nuevas funcionalidades, modificaciones del flujo operativo o actualizaciones exigidas por cambios normativos futuros en los anexos técnicos de la DIAN, se considerará mantenimiento de software. El alcance y valor de dicha asistencia técnica de mantenimiento será negociado de común acuerdo por **LAS PARTES** en el momento en que surja la necesidad, bajo las tarifas, condiciones comerciales y estándares de precio de mercado que rijan para **EL DESARROLLADOR** en dicho momento.

#### CLÁUSULA DÉCIMA: TRATAMIENTO Y TRANSMISIÓN DE DATOS PERSONALES (HABEAS DATA)

En cumplimiento de la Ley 1581 de 2012 y el Decreto 1074 de 2015, **EL CONTRATANTE** (en calidad de Responsable del Tratamiento) garantiza que los datos personales de clientes y operadoras de aseo que migrará al sistema han sido recolectados con autorización previa, expresa e informada. Por su parte, **EL DESARROLLADOR** actuará exclusivamente en calidad de Encargado del Tratamiento de los datos personales con el único fin de ejecutar la migración, pruebas y soporte técnico del software. En virtud de lo anterior, **EL DESARROLLADOR** se obliga a:

1. Tratar los datos únicamente conforme a las instrucciones del Responsable;  
2. Abstenerse de utilizar o divulgar los datos con fines diferentes a los del objeto de este contrato;  
3. Implementar medidas de seguridad técnicas estándar dentro del entorno cloud provisto por el cliente;  
4. Informar a **EL CONTRATANTE** en un plazo máximo de cuarenta y ocho (48) horas en caso de detectar cualquier incidente de seguridad o brecha de datos. **EL CONTRATANTE** mantendrá totalmente indemne a **EL DESARROLLADOR** frente a cualquier reclamación civil o sanción administrativa interpuesta por la Superintendencia de Industria y Comercio (SIC) relacionada con el origen o licitud de los datos suministrados.

#### CLÁUSULA DÉCIMA PRIMERA: SOLUCIÓN DE CONTROVERSIAS Y LEY APLICABLE

1. **Ley Aplicable:** El presente contrato se regirá e interpretará de acuerdo con las leyes vigentes de la República de Colombia.  
2. **Solución de Controversias:** Cualquier diferencia, disputa o conflicto que surja entre **LAS PARTES** con ocasión de la celebración, ejecución, interpretación, terminación o liquidación de este contrato se resolverá bajo el siguiente procedimiento:  
* **Arreglo Directo:** Las partes dispondrán de un término de diez (10) días hábiles contados a partir de la comunicación escrita de la diferencia para intentar resolverla de mutuo acuerdo.  
* **Conciliación en Primera Instancia:** De no lograrse un acuerdo directo en el plazo estipulado, **LAS PARTES** acudirán obligatoriamente a una audiencia de conciliación extrajudicial en derecho ante el **Centro de Conciliación de la Cámara de Comercio de Medellín**.  
* **Jurisdicción Ordinaria:** Si la audiencia de conciliación se declara fallida de forma total o parcial, la controversia será sometida definitivamente a decisión de los **Jueces Civiles de la República de Colombia** de la ciudad de Medellín, Antioquia.

#### CLÁUSULA DÉCIMA SEGUNDA: INDEPENDENCIA LABORAL Y SEGURIDAD SOCIAL

**LAS PARTES** declaran expresamente que entre ellas no existe vínculo, relación laboral, ni de subordinación alguna de carácter laboral. El presente contrato es de carácter estrictamente civil y comercial. **EL DESARROLLADOR** ejecutará el objeto contractual con plena autonomía técnica, administrativa y directiva, utilizando sus propios medios y herramientas de trabajo.

**PARÁGRAFO: SEGURIDAD SOCIAL.** En su calidad de contratista independiente, **EL DESARROLLADOR** asumirá de manera exclusiva la afiliación y el pago de sus aportes al Sistema de Seguridad Social Integral (Salud, Pensión y Riesgos Laborales - ARL) de conformidad con las leyes colombianas vigentes. De ser requerido para el trámite del pago del saldo final, **EL DESARROLLADOR** presentará la planilla de autoliquidación de aportes (PILA) correspondiente al período de ejecución.

#### CLÁUSULA DÉCIMA TERCERA: CONFIDENCIALIDAD

**LAS PARTES** se obligan a mantener bajo estricta reserva y confidencialidad toda la información técnica, comercial, operativa, financiera, de bases de datos de clientes, empleados o metodologías de desarrollo a la que tengan acceso con ocasión de la ejecución de este contrato. Esta obligación de no divulgación e indemnidad sobrevivirá por un término de dos (2) años contados a partir de la terminación o liquidación del presente contrato.

#### CLÁUSULA DÉCIMA CUARTA: DIVISIBILIDAD (SEVERABILIDAD)

Si cualquier cláusula, parágrafo o disposición de este contrato fuere declarada nula, ilegal o ineficaz por un juez o tribunal competente, dicha declaración no afectará la validez, legalidad y exigibilidad de las demás disposiciones del contrato, las cuales conservarán plena vigencia y efecto vinculante para **LAS PARTES**.

#### CLÁUSULA DÉCIMA QUINTA: VALIDEZ DE LA FIRMA ELECTRÓNICA

De conformidad con lo dispuesto en la Ley 527 de 1999 y el Decreto 2364 de 2012, **LAS PARTES** aceptan y acuerdan que el presente contrato podrá ser firmado de manera física, mecánica o a través de firmas electrónicas, digitales o mediante el intercambio de mensajes de datos con firmas escaneadas en formato PDF enviados por correo electrónico. Dichos mecanismos de firma gozarán de total validez, autenticidad e integridad, obligando a las partes en los mismos términos que una firma manuscrita.

#### CLÁUSULA DÉCIMA SEXTA: DIRECCIONES Y NOTIFICACIONES

Para todos los efectos legales y contractuales, las direcciones de notificación física y de correo electrónico oficiales de **LAS PARTES** serán las siguientes, aceptando que las comunicaciones enviadas a los correos electrónicos registrados surtirán plenos efectos de notificación formal:

* **EL CONTRATANTE:**  
    
* Dirección Física: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
    
* Correo Electrónico: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
    
* Teléfono: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
    
* **EL DESARROLLADOR:**  
    
* Dirección Física: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
    
* Correo Electrónico: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
    
* Teléfono: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Para constancia de lo acordado, se firma por **LAS PARTES** en dos (2) ejemplares del mismo tenor y valor probatorio, en la ciudad de Medellín, a los \_\_\_\_\_\_ días del mes de \_\_\_\_\_\_\_\_\_\_\_\_ del año 2026\.

---

**EL CONTRATANTE**  
Representante Legal de **ASEO Y CONFORT GROUP S.A.S.**  
NIT. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**EL DESARROLLADOR**  
**SERGIO VALENCIA GALLEGO**  
C.C. No. 1.152.209.473

---

