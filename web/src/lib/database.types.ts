
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_user": {
                  Row: {
                    "created_at": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"business": {
                  Row: {
                    "aliases": (string)[],"category": string,"created_at": string,"created_by": string | null,"customer_types": (string)[],"domains": (string)[],"id": string,"location": string,"name": string,"place_id": string | null,"service_area": string | null,"services": (string)[],"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"category": string,"created_at"?: string,"created_by"?: string | null,"customer_types"?: (string)[],"domains"?: (string)[],"id"?: string,"location": string,"name": string,"place_id"?: string | null,"service_area"?: string | null,"services"?: (string)[],"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "aliases"?: (string)[],"category"?: string,"created_at"?: string,"created_by"?: string | null,"customer_types"?: (string)[],"domains"?: (string)[],"id"?: string,"location"?: string,"name"?: string,"place_id"?: string | null,"service_area"?: string | null,"services"?: (string)[],"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"engine_answer": {
                  Row: {
                    "answer_text": string | null,"citations": NonNullable<Json>,"created_at": string,"engine": string,"error": string | null,"id": string,"model": string,"prompt_id": string,"prompt_set_id": string,"prompt_text": string,"raw_response": Json | null,"report_id": string,"request_id": string | null,"requested_at": string,"responded_at": string | null,"settings": NonNullable<Json>,"stage_run_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_text"?: string | null,"citations"?: NonNullable<Json>,"created_at"?: string,"engine": string,"error"?: string | null,"id"?: string,"model": string,"prompt_id": string,"prompt_set_id": string,"prompt_text": string,"raw_response"?: Json | null,"report_id": string,"request_id"?: string | null,"requested_at": string,"responded_at"?: string | null,"settings"?: NonNullable<Json>,"stage_run_id"?: string | null,"status": string
                  }
                  Update: {
                    "answer_text"?: string | null,"citations"?: NonNullable<Json>,"created_at"?: string,"engine"?: string,"error"?: string | null,"id"?: string,"model"?: string,"prompt_id"?: string,"prompt_set_id"?: string,"prompt_text"?: string,"raw_response"?: Json | null,"report_id"?: string,"request_id"?: string | null,"requested_at"?: string,"responded_at"?: string | null,"settings"?: NonNullable<Json>,"stage_run_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "engine_answer_prompt_set_id_fkey"
      columns: ["prompt_set_id"]
isOneToOne: false
      referencedRelation: "prompt_set"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engine_answer_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engine_answer_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    },{
      foreignKeyName: "engine_answer_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engine_answer_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                },"finding": {
                  Row: {
                    "assumption_rule": string | null,"claim": string,"confidence": number | null,"created_at": string,"evidence": NonNullable<Json>,"id": string,"missing_reason": string | null,"provenance": string,"report_id": string,"section": string,"stage_run_id": string | null,"value": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assumption_rule"?: string | null,"claim": string,"confidence"?: number | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"missing_reason"?: string | null,"provenance": string,"report_id": string,"section": string,"stage_run_id"?: string | null,"value"?: Json | null
                  }
                  Update: {
                    "assumption_rule"?: string | null,"claim"?: string,"confidence"?: number | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"missing_reason"?: string | null,"provenance"?: string,"report_id"?: string,"section"?: string,"stage_run_id"?: string | null,"value"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "finding_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "finding_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    },{
      foreignKeyName: "finding_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "finding_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                },"finding_review": {
                  Row: {
                    "correction": string | null,"finding_id": string,"id": string,"note": string | null,"reviewed_at": string,"reviewer": string | null,"verdict": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correction"?: string | null,"finding_id": string,"id"?: string,"note"?: string | null,"reviewed_at"?: string,"reviewer"?: string | null,"verdict": string
                  }
                  Update: {
                    "correction"?: string | null,"finding_id"?: string,"id"?: string,"note"?: string | null,"reviewed_at"?: string,"reviewer"?: string | null,"verdict"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "finding_review_finding_id_fkey"
      columns: ["finding_id"]
isOneToOne: false
      referencedRelation: "finding"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_snapshot": {
                  Row: {
                    "business_id": string | null,"created_at": string,"fetched_at": string,"id": string,"raw_payload": Json | null,"report_id": string | null,"source": string,"source_ref": string | null,"stage_run_id": string | null,"terms_flags": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id"?: string | null,"created_at"?: string,"fetched_at": string,"id"?: string,"raw_payload"?: Json | null,"report_id"?: string | null,"source": string,"source_ref"?: string | null,"stage_run_id"?: string | null,"terms_flags"?: NonNullable<Json>
                  }
                  Update: {
                    "business_id"?: string | null,"created_at"?: string,"fetched_at"?: string,"id"?: string,"raw_payload"?: Json | null,"report_id"?: string | null,"source"?: string,"source_ref"?: string | null,"stage_run_id"?: string | null,"terms_flags"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_snapshot_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "business"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_snapshot_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_snapshot_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    },{
      foreignKeyName: "listing_snapshot_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_snapshot_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                },"page_snapshot": {
                  Row: {
                    "content_hash": string | null,"created_at": string,"engine": string | null,"error": string | null,"fetch_mode": string,"fetched_at": string,"final_url": string | null,"http_status": number | null,"id": string,"report_id": string | null,"stage_run_id": string | null,"storage_path": string | null,"text_hash": string | null,"url": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content_hash"?: string | null,"created_at"?: string,"engine"?: string | null,"error"?: string | null,"fetch_mode": string,"fetched_at": string,"final_url"?: string | null,"http_status"?: number | null,"id"?: string,"report_id"?: string | null,"stage_run_id"?: string | null,"storage_path"?: string | null,"text_hash"?: string | null,"url": string,"user_agent"?: string | null
                  }
                  Update: {
                    "content_hash"?: string | null,"created_at"?: string,"engine"?: string | null,"error"?: string | null,"fetch_mode"?: string,"fetched_at"?: string,"final_url"?: string | null,"http_status"?: number | null,"id"?: string,"report_id"?: string | null,"stage_run_id"?: string | null,"storage_path"?: string | null,"text_hash"?: string | null,"url"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_snapshot_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_snapshot_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    },{
      foreignKeyName: "page_snapshot_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_snapshot_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                },"pricing": {
                  Row: {
                    "created_at": string,"effective_from": string,"id": number,"input_usd_per_mtok": number,"model": string,"output_usd_per_mtok": number,"provider": string,"request_usd_per_call": number,"search_usd_per_call": number,"source": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_from"?: string,"id"?: never,"input_usd_per_mtok"?: number,"model": string,"output_usd_per_mtok"?: number,"provider": string,"request_usd_per_call"?: number,"search_usd_per_call"?: number,"source": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"effective_from"?: string,"id"?: never,"input_usd_per_mtok"?: number,"model"?: string,"output_usd_per_mtok"?: number,"provider"?: string,"request_usd_per_call"?: number,"search_usd_per_call"?: number,"source"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"prompt_set": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"created_by": string | null,"id": string,"prompts": NonNullable<Json>,"report_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"prompts"?: NonNullable<Json>,"report_id": string,"version": number
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"prompts"?: NonNullable<Json>,"report_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prompt_set_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prompt_set_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    }
                  ]
                },"report": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"spending_cap_usd": number,"status": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"spending_cap_usd"?: number,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"spending_cap_usd"?: number,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "business"
      referencedColumns: ["id"]
    }
                  ]
                },"report_document": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document": NonNullable<Json>,"fixture_id": string | null,"id": string,"report_id": string,"schema_version": string,"source": string,"stage_run_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document": NonNullable<Json>,"fixture_id"?: string | null,"id"?: string,"report_id": string,"schema_version": string,"source": string,"stage_run_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document"?: NonNullable<Json>,"fixture_id"?: string | null,"id"?: string,"report_id"?: string,"schema_version"?: string,"source"?: string,"stage_run_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_document_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_document_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    },{
      foreignKeyName: "report_document_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_document_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_run": {
                  Row: {
                    "attempt": number,"cost_usd": number,"created_at": string,"created_by": string | null,"duration_ms": number | null,"error": string | null,"finished_at": string | null,"id": string,"input_run_ids": (string)[],"inputs_hash": string,"locked_until": string | null,"max_attempts": number,"output": Json | null,"output_hash": string | null,"params": NonNullable<Json>,"pricing_ids": (number)[],"report_id": string,"run_after": string,"search_calls": number,"stage": string,"started_at": string | null,"status": string,"timeout_ms": number,"tokens_in": number,"tokens_out": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"cost_usd"?: number,"created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input_run_ids"?: (string)[],"inputs_hash": string,"locked_until"?: string | null,"max_attempts"?: number,"output"?: Json | null,"output_hash"?: string | null,"params"?: NonNullable<Json>,"pricing_ids"?: (number)[],"report_id": string,"run_after"?: string,"search_calls"?: number,"stage": string,"started_at"?: string | null,"status"?: string,"timeout_ms"?: number,"tokens_in"?: number,"tokens_out"?: number,"version": number
                  }
                  Update: {
                    "attempt"?: number,"cost_usd"?: number,"created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input_run_ids"?: (string)[],"inputs_hash"?: string,"locked_until"?: string | null,"max_attempts"?: number,"output"?: Json | null,"output_hash"?: string | null,"params"?: NonNullable<Json>,"pricing_ids"?: (number)[],"report_id"?: string,"run_after"?: string,"search_calls"?: number,"stage"?: string,"started_at"?: string | null,"status"?: string,"timeout_ms"?: number,"tokens_in"?: number,"tokens_out"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_run_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_run_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    }
                  ]
                },"stage_run_stale": {
                  Row: {
                    "caused_by_run_id": string,"id": number,"marked_at": string,"stage_run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caused_by_run_id": string,"id"?: never,"marked_at"?: string,"stage_run_id": string
                  }
                  Update: {
                    "caused_by_run_id"?: string,"id"?: never,"marked_at"?: string,"stage_run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_run_stale_caused_by_run_id_fkey"
      columns: ["caused_by_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_run_stale_caused_by_run_id_fkey"
      columns: ["caused_by_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_run_stale_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_run_stale_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_event": {
                  Row: {
                    "attempt": number,"cost_usd": number,"created_at": string,"duration_ms": number,"error": string | null,"id": number,"model": string,"pricing_id": number,"provider": string,"requests": number,"search_calls": number,"stage_run_id": string,"succeeded": boolean,"tokens_in": number,"tokens_out": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt": number,"cost_usd": number,"created_at"?: string,"duration_ms": number,"error"?: string | null,"id"?: never,"model": string,"pricing_id": number,"provider": string,"requests"?: number,"search_calls"?: number,"stage_run_id": string,"succeeded": boolean,"tokens_in"?: number,"tokens_out"?: number
                  }
                  Update: {
                    "attempt"?: number,"cost_usd"?: number,"created_at"?: string,"duration_ms"?: number,"error"?: string | null,"id"?: never,"model"?: string,"pricing_id"?: number,"provider"?: string,"requests"?: number,"search_calls"?: number,"stage_run_id"?: string,"succeeded"?: boolean,"tokens_in"?: number,"tokens_out"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_event_pricing_id_fkey"
      columns: ["pricing_id"]
isOneToOne: false
      referencedRelation: "pricing"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_event_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_event_stage_run_id_fkey"
      columns: ["stage_run_id"]
isOneToOne: false
      referencedRelation: "stage_run_overview"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "report_cost_rollup": {
                  Row: {
                    "cost_usd": number | null,"duration_ms": number | null,"failed_runs": number | null,"report_id": string,"search_calls": number | null,"spending_cap_usd": number,"stage_runs": number | null,"tokens_in": number | null,"tokens_out": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"stage_run_overview": {
                  Row: {
                    "attempt": number,"cost_usd": number,"created_at": string,"created_by": string | null,"duration_ms": number | null,"error": string | null,"failed_calls": number | null,"finished_at": string | null,"id": string,"input_run_ids": (string)[],"inputs_hash": string,"is_latest": boolean | null,"is_stale": boolean | null,"locked_until": string | null,"max_attempts": number,"output": Json | null,"output_hash": string | null,"params": NonNullable<Json>,"pricing_ids": (number)[],"report_id": string,"run_after": string,"search_calls": number,"stage": string,"started_at": string | null,"status": string,"timeout_ms": number,"tokens_in": number,"tokens_out": number,"version": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stage_run_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_run_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_cost_rollup"
      referencedColumns: ["report_id"]
    }
                  ]
                }
          }
          Functions: {
            "claim_stage_runs":
{ Args: { "p_lease_margin_ms"?: number,"p_limit": number,"p_max_timeout_ms": number }; Returns: {
              "attempt": number,
"cost_usd": number,
"created_at": string,
"created_by": string | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"input_run_ids": (string)[],
"inputs_hash": string,
"locked_until": string | null,
"max_attempts": number,
"output": Json | null,
"output_hash": string | null,
"params": NonNullable<Json>,
"pricing_ids": (number)[],
"report_id": string,
"run_after": string,
"search_calls": number,
"stage": string,
"started_at": string | null,
"status": string,
"timeout_ms": number,
"tokens_in": number,
"tokens_out": number,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "stage_run"
        isOneToOne: false
        isSetofReturn: true
      } },
"enqueue_stage_run":
{ Args: { "p_downstream_stages": (string)[],"p_input_run_ids": (string)[],"p_inputs_hash": string,"p_max_attempts": number,"p_params": Json,"p_report_id": string,"p_stage": string,"p_timeout_ms": number }; Returns: {
              "attempt": number,
"cost_usd": number,
"created_at": string,
"created_by": string | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"input_run_ids": (string)[],
"inputs_hash": string,
"locked_until": string | null,
"max_attempts": number,
"output": Json | null,
"output_hash": string | null,
"params": NonNullable<Json>,
"pricing_ids": (number)[],
"report_id": string,
"run_after": string,
"search_calls": number,
"stage": string,
"started_at": string | null,
"status": string,
"timeout_ms": number,
"tokens_in": number,
"tokens_out": number,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "stage_run"
        isOneToOne: true
        isSetofReturn: false
      } },
"finish_stage_run":
{ Args: { "p_attempt": number,"p_error": string,"p_id": string,"p_output": Json,"p_output_hash": string,"p_status": string }; Returns: boolean
                           },
"health_check":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"load_fixture_report":
{ Args: { "p_category": string,"p_document": Json,"p_domains": (string)[],"p_fixture_id": string,"p_location": string,"p_name": string,"p_schema_version": string,"p_website": string }; Returns: string
                           },
"recover_expired_stage_runs":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"report_spend_usd":
{ Args: { "p_report_id": string }; Returns: number
                           },
"retry_stage_run":
{ Args: { "p_attempt": number,"p_error": string,"p_id": string,"p_run_after": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
