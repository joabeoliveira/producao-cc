# Dicionário de Dados — Painel Produção Cirúrgica HGB/GHC

| Campo | Tipo | Descrição | Regra |
|---|---|---|---|
| id_evento | texto | Hash do evento cirúrgico | CNS+data+sala+início+proc principal |
| mes | texto | Mês de referência | 2026-08/09/10 |
| data_cirurgia | data | Data da cirurgia | dd/mm/aaaa convertido |
| dia_semana | texto | Dia da semana | pt-BR |
| turno | texto | Diurno/Noturno | Início ≥19h ou <7h = Noturno |
| status | texto | Realizada/Suspensa | original |
| tipo_cirurgia | texto | Eletiva/Emergência | original |
| porte | texto | P/M/G | original |
| oncologica | texto | Sim/Não | original |
| sala | texto | Sala do centro cirúrgico | original |
| procedencia | texto | Origem do paciente | original |
| destino | texto | Destino pós-cirúrgico | original |
| tipo_anestesia | texto | Tipo de anestesia | original |
| procedimento_principal | texto | Procedimento principal (sem código) | se vazio, usa secundário |
| procedimento_secundario | texto | Procedimento secundário | original |
| grupo_sigtap | texto | Grupo SIGTAP (4 primeiros níveis) | extraído do código |
| cid | texto | CID-10 | original |
| grupo_cid | texto | Descrição do CID | original |
| qtd_sigtap | número | Qtd. do mesmo código SIGTAP no ato | métrica secundária |
| t_* | hora | Horários do ato | convertidos |
| tempo_cirurgico_min | número | Término − Início cirurgia (min) | recalculado |
| ocupacao_sala_min | número | Saída S.O − Entrada C.C (min) | recalculado |
| setup_entrada_inicio_min | número | Início cirurgia − Entrada C.C (min) | recalculado |
| pos_cirurgia_min | número | Saída S.O − Término cirurgia (min) | recalculado |
| iniciou_apos_22h | texto | Sim/Não | Início ≥22h ou <6h |
| tempo_invalido | texto | Sim/Não | tempo ≤0 ou ausente |
| motivo_suspensao_padronizado | texto | Categoria padronizada | apenas Suspensa |
| cirurgiao_anon | texto | Cirurgião anonimizado | formato C |
| anestesista_anon | texto | Anestesista anonimizado | formato C |