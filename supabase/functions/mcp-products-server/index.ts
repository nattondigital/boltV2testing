import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, Accept, Mcp-Session-Id',
}

interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

const sessions = new Map<string, { agentId?: string; initialized: boolean }>()

function generateSessionId(): string {
  return `mcp-session-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

async function handleMCPRequest(
  message: MCPMessage,
  sessionId: string,
  supabase: any
): Promise<MCPMessage> {
  const { method, params, id } = message

  const response: MCPMessage = {
    jsonrpc: '2.0',
    id: id || 1,
  }

  try {
    switch (method) {
      case 'initialize': {
        const clientInfo = params?.clientInfo
        const agentId = clientInfo?.agentId || params?.agentId

        sessions.set(sessionId, {
          initialized: true,
          agentId: agentId
        })

        console.log('MCP Products Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-products-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'products://all',
              name: 'All Products',
              description: 'Complete list of all products',
              mimeType: 'application/json',
            },
            {
              uri: 'products://active',
              name: 'Active Products',
              description: 'Products currently available for sale',
              mimeType: 'application/json',
            },
            {
              uri: 'products://by-type',
              name: 'Products by Type',
              description: 'Products grouped by product type',
              mimeType: 'application/json',
            },
            {
              uri: 'products://statistics',
              name: 'Product Statistics',
              description: 'Sales and revenue statistics',
              mimeType: 'application/json',
            },
          ],
        }
        break
      }

      case 'resources/read': {
        const { uri } = params

        if (!uri) {
          throw new Error('URI is required')
        }

        if (uri === 'products://statistics') {
          const { data: allProducts, error: allError } = await supabase
            .from('products')
            .select('*')

          if (allError) throw allError

          const stats = {
            total_products: allProducts?.length || 0,
            active_products: allProducts?.filter((p: any) => p.is_active).length || 0,
            total_sales: allProducts?.reduce((sum: number, p: any) => sum + (p.total_sales || 0), 0) || 0,
            total_revenue: allProducts?.reduce((sum: number, p: any) => sum + (p.total_revenue || 0), 0) || 0,
            by_type: {} as Record<string, number>,
            by_category: {} as Record<string, number>,
            by_pricing_model: {} as Record<string, number>,
          }

          allProducts?.forEach((product: any) => {
            const type = product.product_type || 'Unknown'
            const category = product.category || 'Uncategorized'
            const pricing = product.pricing_model || 'Unknown'

            stats.by_type[type] = (stats.by_type[type] || 0) + 1
            stats.by_category[category] = (stats.by_category[category] || 0) + 1
            stats.by_pricing_model[pricing] = (stats.by_pricing_model[pricing] || 0) + 1
          })

          response.result = {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          }
        } else if (uri === 'products://by-type') {
          const { data, error } = await supabase
            .from('products')
            .select('product_type, product_id, product_name, category, pricing_model, is_active')
            .order('product_type', { ascending: true })
            .order('product_name', { ascending: true })

          if (error) throw error

          const grouped: Record<string, any[]> = {}
          data?.forEach((product: any) => {
            const type = product.product_type || 'Unknown'
            if (!grouped[type]) {
              grouped[type] = []
            }
            grouped[type].push(product)
          })

          response.result = {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(grouped, null, 2),
              },
            ],
          }
        } else {
          let query = supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })

          if (uri === 'products://active') {
            query = query.eq('is_active', true)
          }

          const { data, error } = await query

          if (error) throw error

          response.result = {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(data, null, 2),
              },
            ],
          }
        }
        break
      }

      case 'prompts/list': {
        response.result = {
          prompts: [
            {
              name: 'product_catalog',
              description: 'Provides a complete product catalog with pricing and features',
              arguments: [],
            },
          ],
        }
        break
      }

      case 'tools/list': {
        response.result = {
          tools: [
            {
              name: 'get_products',
              description: 'Retrieve products with filtering. Returns product details including product_id, name, type, pricing, features, sales data. Use this to get specific products or filtered lists. For statistics, use get_product_summary instead.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  product_id: {
                    type: 'string',
                    description: 'Get a specific product by product_id',
                  },
                  product_type: {
                    type: 'string',
                    description: 'Filter by product type',
                  },
                  category: {
                    type: 'string',
                    description: 'Filter by category',
                  },
                  pricing_model: {
                    type: 'string',
                    enum: ['One-Time', 'Recurring', 'Mixed'],
                    description: 'Filter by pricing model',
                  },
                  is_active: {
                    type: 'boolean',
                    description: 'Filter by active status (default: true shows only active products)',
                  },
                  search: {
                    type: 'string',
                    description: 'Search in product name and description',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of products to return (default: 50)',
                  },
                },
              },
            },
            {
              name: 'get_product_summary',
              description: 'Get aggregated product statistics. Returns total products, sales figures, revenue, breakdown by type/category/pricing model. Use this for questions about product statistics or inventory summaries.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  product_type: {
                    type: 'string',
                    description: 'Filter summary by specific product type (optional)',
                  },
                  is_active: {
                    type: 'boolean',
                    description: 'Filter summary by active status (optional)',
                  },
                },
              },
            },
            {
              name: 'create_product',
              description: 'Create a new product. Product ID will be auto-generated. Supports both training courses and service offerings with flexible pricing models.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  product_name: {
                    type: 'string',
                    description: 'Product name (required)',
                  },
                  product_type: {
                    type: 'string',
                    description: 'Product type (required)',
                  },
                  description: {
                    type: 'string',
                    description: 'Product description',
                  },
                  pricing_model: {
                    type: 'string',
                    enum: ['One-Time', 'Recurring', 'Mixed'],
                    description: 'Pricing structure (required)',
                  },
                  course_price: {
                    type: 'number',
                    description: 'One-time price for courses/services',
                  },
                  onboarding_fee: {
                    type: 'number',
                    description: 'One-time setup fee for services',
                  },
                  retainer_fee: {
                    type: 'number',
                    description: 'Monthly recurring fee for services',
                  },
                  currency: {
                    type: 'string',
                    description: 'Currency code (default: INR)',
                  },
                  features: {
                    type: 'array',
                    description: 'Array of product features/benefits',
                  },
                  duration: {
                    type: 'string',
                    description: 'Course duration or service commitment period',
                  },
                  category: {
                    type: 'string',
                    description: 'Product category',
                  },
                  thumbnail_url: {
                    type: 'string',
                    description: 'Product image URL',
                  },
                  sales_page_url: {
                    type: 'string',
                    description: 'Sales/landing page URL',
                  },
                  is_active: {
                    type: 'boolean',
                    description: 'Product availability (default: true)',
                  },
                },
                required: ['product_name', 'product_type', 'pricing_model'],
              },
            },
            {
              name: 'update_product',
              description: 'Update an existing product. Can update pricing, features, status, and all other product details.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  product_id: {
                    type: 'string',
                    description: 'Product ID to update (required)',
                  },
                  product_name: { type: 'string' },
                  product_type: { type: 'string' },
                  description: { type: 'string' },
                  pricing_model: {
                    type: 'string',
                    enum: ['One-Time', 'Recurring', 'Mixed'],
                  },
                  course_price: { type: 'number' },
                  onboarding_fee: { type: 'number' },
                  retainer_fee: { type: 'number' },
                  currency: { type: 'string' },
                  features: { type: 'array' },
                  duration: { type: 'string' },
                  category: { type: 'string' },
                  thumbnail_url: { type: 'string' },
                  sales_page_url: { type: 'string' },
                  is_active: { type: 'boolean' },
                  total_sales: { type: 'number' },
                  total_revenue: { type: 'number' },
                },
                required: ['product_id'],
              },
            },
            {
              name: 'delete_product',
              description: 'Delete a product by product_id',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  product_id: {
                    type: 'string',
                    description: 'Product ID to delete',
                  },
                },
                required: ['product_id'],
              },
            },
          ],
        }
        break
      }

      case 'tools/call': {
        const { name, arguments: args } = params
        const agentId = args?.agent_id

        if (!agentId) {
          throw new Error('agent_id is required in arguments')
        }

        const { data: agent, error: agentError } = await supabase
          .from('ai_agents')
          .select('name')
          .eq('id', agentId)
          .maybeSingle()

        if (agentError || !agent) {
          throw new Error('Agent not found')
        }

        const agentName = agent.name

        const { data: permissions, error: permError } = await supabase
          .from('ai_agent_permissions')
          .select('permissions')
          .eq('agent_id', agentId)
          .maybeSingle()

        if (permError || !permissions) {
          throw new Error('Agent not found or no permissions set')
        }

        const allPermissions = permissions.permissions || {}
        const productsServerPerms = allPermissions['products-server'] || { enabled: false, tools: [] }
        const enabledTools = productsServerPerms.tools || []

        switch (name) {
          case 'get_products': {
            if (!enabledTools.includes('get_products')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'get_products',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view products' },
              })
              throw new Error('Agent does not have permission to view products')
            }

            let query = supabase
              .from('products')
              .select('*')
              .order('created_at', { ascending: false })

            if (args.product_id) {
              query = query.eq('product_id', args.product_id)
            }
            if (args.product_type) {
              query = query.eq('product_type', args.product_type)
            }
            if (args.category) {
              query = query.ilike('category', `%${args.category}%`)
            }
            if (args.pricing_model) {
              query = query.eq('pricing_model', args.pricing_model)
            }
            if (args.is_active !== undefined) {
              query = query.eq('is_active', args.is_active)
            } else {
              query = query.eq('is_active', true)
            }
            if (args.search) {
              query = query.or(`product_name.ilike.%${args.search}%,description.ilike.%${args.search}%`)
            }

            if (args.limit) {
              query = query.limit(args.limit)
            } else {
              query = query.limit(50)
            }

            const { data, error } = await query

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'get_products',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Products',
              action: 'get_products',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { filters: args, result_count: data?.length || 0 },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_product_summary': {
            if (!enabledTools.includes('get_products')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'get_product_summary',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view products' },
              })
              throw new Error('Agent does not have permission to view products')
            }

            let query = supabase.from('products').select('*')

            if (args.product_type) {
              query = query.eq('product_type', args.product_type)
            }
            if (args.is_active !== undefined) {
              query = query.eq('is_active', args.is_active)
            }

            const { data: products, error } = await query

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'get_product_summary',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            const summary = {
              total_count: products?.length || 0,
              active_count: products?.filter((p: any) => p.is_active).length || 0,
              total_sales: products?.reduce((sum: number, p: any) => sum + (p.total_sales || 0), 0) || 0,
              total_revenue: products?.reduce((sum: number, p: any) => sum + (p.total_revenue || 0), 0) || 0,
              by_type: {} as Record<string, { count: number; sales: number; revenue: number }>,
              by_pricing_model: {} as Record<string, { count: number }>,
              by_category: {} as Record<string, { count: number }>,
              top_products: products
                ?.sort((a: any, b: any) => (b.total_sales || 0) - (a.total_sales || 0))
                .slice(0, 5)
                .map((p: any) => ({
                  product_id: p.product_id,
                  product_name: p.product_name,
                  total_sales: p.total_sales,
                  total_revenue: p.total_revenue,
                })) || [],
            }

            products?.forEach((product: any) => {
              const type = product.product_type || 'Unknown'
              const pricing = product.pricing_model || 'Unknown'
              const category = product.category || 'Uncategorized'

              if (!summary.by_type[type]) {
                summary.by_type[type] = { count: 0, sales: 0, revenue: 0 }
              }
              summary.by_type[type].count += 1
              summary.by_type[type].sales += product.total_sales || 0
              summary.by_type[type].revenue += product.total_revenue || 0

              if (!summary.by_pricing_model[pricing]) {
                summary.by_pricing_model[pricing] = { count: 0 }
              }
              summary.by_pricing_model[pricing].count += 1

              if (!summary.by_category[category]) {
                summary.by_category[category] = { count: 0 }
              }
              summary.by_category[category].count += 1
            })

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Products',
              action: 'get_product_summary',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { filters: args, total_products: summary.total_count },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, summary }, null, 2),
                },
              ],
            }
            break
          }

          case 'create_product': {
            if (!enabledTools.includes('create_product')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'create_product',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create products' },
              })
              throw new Error('Agent does not have permission to create products')
            }

            const productData: any = {
              product_name: args.product_name,
              product_type: args.product_type,
              pricing_model: args.pricing_model,
            }

            if (args.description) productData.description = args.description
            if (args.course_price !== undefined) productData.course_price = args.course_price
            if (args.onboarding_fee !== undefined) productData.onboarding_fee = args.onboarding_fee
            if (args.retainer_fee !== undefined) productData.retainer_fee = args.retainer_fee
            if (args.currency) productData.currency = args.currency
            if (args.features) productData.features = JSON.stringify(args.features)
            if (args.duration) productData.duration = args.duration
            if (args.category) productData.category = args.category
            if (args.thumbnail_url) productData.thumbnail_url = args.thumbnail_url
            if (args.sales_page_url) productData.sales_page_url = args.sales_page_url
            if (args.is_active !== undefined) productData.is_active = args.is_active

            const { data, error } = await supabase
              .from('products')
              .insert(productData)
              .select('*')
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'create_product',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, product_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Products',
              action: 'create_product',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { product_id: data.product_id, product_name: args.product_name },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Product created successfully',
                    product: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_product': {
            if (!enabledTools.includes('update_product')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'update_product',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to update products' },
              })
              throw new Error('Agent does not have permission to update products')
            }

            const { product_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            if (updates.features && Array.isArray(updates.features)) {
              updates.features = JSON.stringify(updates.features)
            }

            const { data, error } = await supabase
              .from('products')
              .update(updates)
              .eq('product_id', product_id)
              .select('*')
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'update_product',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, product_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Products',
              action: 'update_product',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { product_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Product updated successfully', product: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_product': {
            if (!enabledTools.includes('delete_product')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'delete_product',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete products' },
              })
              throw new Error('Agent does not have permission to delete products')
            }

            const { error } = await supabase
              .from('products')
              .delete()
              .eq('product_id', args.product_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Products',
                action: 'delete_product',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, product_id: args.product_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Products',
              action: 'delete_product',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { product_id: args.product_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Product deleted successfully', product_id: args.product_id }, null, 2),
                },
              ],
            }
            break
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
        break
      }

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  } catch (error: any) {
    response.error = {
      code: -32603,
      message: error.message || 'Internal error',
      data: error.stack,
    }
  }

  return response
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let sessionId = req.headers.get('Mcp-Session-Id')
    if (!sessionId) {
      sessionId = generateSessionId()
    }

    const message: MCPMessage = await req.json()
    const response = await handleMCPRequest(message, sessionId, supabase)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId,
      },
    })
  } catch (error: any) {
    console.error('MCP Products Server Error:', error)
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: error.message,
        },
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
