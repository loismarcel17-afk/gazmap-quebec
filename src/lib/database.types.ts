
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "consents": {
                  Row: {
                    "created_at": string,"document_version": string | null,"granted": boolean,"id": number,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_version"?: string | null,"granted": boolean,"id"?: never,"kind": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"document_version"?: string | null,"granted"?: boolean,"id"?: never,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fill_ups": {
                  Row: {
                    "created_at": string,"filled": boolean,"fuel": string | null,"id": string,"price_displayed": number | null,"price_paid": number | null,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filled": boolean,"fuel"?: string | null,"id"?: string,"price_displayed"?: number | null,"price_paid"?: number | null,"trip_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"filled"?: boolean,"fuel"?: string | null,"id"?: string,"price_displayed"?: number | null,"price_paid"?: number | null,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fill_ups_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: true
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"import_runs": {
                  Row: {
                    "error": string | null,"id": number,"issue_count": number | null,"price_change_count": number | null,"published_at": string | null,"source_etag": string | null,"started_at": string,"station_count": number | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"id"?: never,"issue_count"?: number | null,"price_change_count"?: number | null,"published_at"?: string | null,"source_etag"?: string | null,"started_at"?: string,"station_count"?: number | null,"status": string
                  }
                  Update: {
                    "error"?: string | null,"id"?: never,"issue_count"?: number | null,"price_change_count"?: number | null,"published_at"?: string | null,"source_etag"?: string | null,"started_at"?: string,"station_count"?: number | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"station_price_history": {
                  Row: {
                    "price_diesel": number | null,"price_premium": number | null,"price_regular": number | null,"published_at": string,"station_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "price_diesel"?: number | null,"price_premium"?: number | null,"price_regular"?: number | null,"published_at": string,"station_id": string
                  }
                  Update: {
                    "price_diesel"?: number | null,"price_premium"?: number | null,"price_regular"?: number | null,"published_at"?: string,"station_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "station_price_history_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    }
                  ]
                },"stations": {
                  Row: {
                    "address": string,"brand": string | null,"created_at": string,"id": string,"last_seen_at": string | null,"lat": number,"lng": number,"location": unknown,"name": string | null,"postal_code": string,"price_diesel": number | null,"price_premium": number | null,"price_regular": number | null,"prices_updated_at": string,"region": string,"sponsored": boolean,"status": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"brand"?: string | null,"created_at"?: string,"id": string,"last_seen_at"?: string | null,"lat": number,"lng": number,"location"?: never,"name"?: string | null,"postal_code": string,"price_diesel"?: number | null,"price_premium"?: number | null,"price_regular"?: number | null,"prices_updated_at": string,"region": string,"sponsored"?: boolean,"status"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"brand"?: string | null,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"lat"?: number,"lng"?: number,"location"?: never,"name"?: string | null,"postal_code"?: string,"price_diesel"?: number | null,"price_premium"?: number | null,"price_regular"?: number | null,"prices_updated_at"?: string,"region"?: string,"sponsored"?: boolean,"status"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trips": {
                  Row: {
                    "ended_at": string | null,"fuel": string,"id": string,"mode": string,"price_at_start": number | null,"started_at": string,"station_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: string | null,"fuel": string,"id"?: string,"mode": string,"price_at_start"?: number | null,"started_at"?: string,"station_id": string,"status"?: string,"user_id"?: string
                  }
                  Update: {
                    "ended_at"?: string | null,"fuel"?: string,"id"?: string,"mode"?: string,"price_at_start"?: number | null,"started_at"?: string,"station_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_models": {
                  Row: {
                    "city_l_per_100km": number,"combined_l_per_100km": number,"cylinders": number,"engine_l": number,"fuel_type": string,"highway_l_per_100km": number,"id": number,"make": string,"model": string,"model_year": number,"transmission": string,"vehicle_class": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city_l_per_100km": number,"combined_l_per_100km": number,"cylinders": number,"engine_l": number,"fuel_type": string,"highway_l_per_100km": number,"id"?: never,"make": string,"model": string,"model_year": number,"transmission": string,"vehicle_class": string
                  }
                  Update: {
                    "city_l_per_100km"?: number,"combined_l_per_100km"?: number,"cylinders"?: number,"engine_l"?: number,"fuel_type"?: string,"highway_l_per_100km"?: number,"id"?: never,"make"?: string,"model"?: string,"model_year"?: number,"transmission"?: string,"vehicle_class"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "my_consents": {
                  Row: {
                    "created_at": string,"document_version": string | null,"granted": boolean,"kind": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "can_answer_trip":
{ Args: { "p_trip_id": string }; Returns: boolean
                           },
"can_start_trip":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"has_accepted_terms":
{ Args: { "p_version": string }; Returns: boolean
                           },
"has_granted_terms":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"import_health":
{ Args: Record<PropertyKey, never>; Returns: {
              "last_ok_at": string,"last_run_at": string,"last_status": string,"prices_published_at": string
            }[]
                           },
"import_nrcan_models":
{ Args: { "p_models": Json }; Returns: number
                           },
"import_regie_stations":
{ Args: { "p_published_at": string,"p_stations": Json }; Returns: {
              "price_change_count": number,"station_count": number
            }[]
                           },
"pending_fill_up_trip":
{ Args: Record<PropertyKey, never>; Returns: {
              "brand": string,"fuel": string,"name": string,"started_at": string,"station_id": string,"trip_id": string
            }[]
                           },
"purge_abandoned_accounts":
{ Args: { "p_older_than"?: string }; Returns: {
              "accounts": number,"log_entries": number
            }[]
                           },
"stations_near":
{ Args: { "p_fuel": string,"p_lat": number,"p_lng": number,"p_radius_m": number }; Returns: {
              "address": string,"brand": string,"distance_m": number,"id": string,"lat": number,"lng": number,"name": string,"postal_code": string,"price": number,"prices_updated_at": string,"region": string
            }[]
                           },
"vehicle_makes":
{ Args: { "p_year": number }; Returns: string[]
                           },
"vehicle_model_years":
{ Args: Record<PropertyKey, never>; Returns: number[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "regie_station_input": {
                        "id": string | null,"name": string | null,"brand": string | null,"address": string | null,"region": string | null,"postal_code": string | null,"lat": number | null,"lng": number | null,"status": string | null,"price_regular": number | null,"price_premium": number | null,"price_diesel": number | null
                      }
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
