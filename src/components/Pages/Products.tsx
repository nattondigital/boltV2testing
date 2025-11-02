import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Eye, Edit, Trash2, Package, TrendingUp, DollarSign, ShoppingCart, X, Save, GraduationCap, Briefcase, MoreVertical, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const productTypeColors: Record<string, string> = {
  'Business Registration': 'bg-blue-100 text-blue-800',
  'Statutory Compliance': 'bg-green-100 text-green-800',
  'Business License': 'bg-purple-100 text-purple-800'
}

const pricingModelColors: Record<string, string> = {
  'One-Time': 'bg-purple-100 text-purple-800',
  'Recurring': 'bg-orange-100 text-orange-800'
}

type ViewType = 'list' | 'add' | 'edit' | 'view'

interface Product {
  id: string
  product_id: string
  product_name: string
  product_type: string
  description: string
  pricing_model: string
  product_price: number
  currency: string
  features: string[]
  duration: string
  is_active: boolean
  thumbnail_url: string | null
  sales_page_url: string | null
  total_sales: number
  total_revenue: number
  created_at: string
  updated_at: string
}

export function Products() {
  const [view, setView] = useState<ViewType>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    product_name: '',
    product_type: '',
    description: '',
    pricing_model: '',
    product_price: '',
    features: '',
    duration: '',
    thumbnail_url: '',
    sales_page_url: '',
    is_active: true
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !typeFilter || product.product_type === typeFilter
    const matchesStatus = !statusFilter || (statusFilter === 'Active' ? product.is_active : !product.is_active)
    return matchesSearch && matchesType && matchesStatus
  })

  const totalProducts = products.length
  const activeProducts = products.filter(p => p.is_active).length
  const totalSales = products.reduce((sum, p) => sum + (p.total_sales || 0), 0)
  const totalRevenue = products.reduce((sum, p) => sum + (p.total_revenue || 0), 0)

  const handleCreateProduct = async () => {
    try {
      const featuresArray = formData.features.split('\n').filter(f => f.trim() !== '')

      const { data, error } = await supabase
        .from('products')
        .insert([{
          product_id: '',
          product_name: formData.product_name,
          product_type: formData.product_type,
          description: formData.description,
          pricing_model: formData.pricing_model,
          product_price: formData.product_price ? parseFloat(formData.product_price) : 0,
          features: featuresArray,
          duration: formData.duration,
          thumbnail_url: formData.thumbnail_url || null,
          sales_page_url: formData.sales_page_url || null,
          is_active: formData.is_active
        }])
        .select()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      await fetchProducts()
      setView('list')
      resetForm()
    } catch (error: any) {
      console.error('Failed to create product:', error)
      alert(`Failed to create product: ${error.message || 'Please try again.'}`)
    }
  }

  const handleEditProduct = async () => {
    if (!selectedProduct) return

    try {
      const featuresArray = formData.features.split('\n').filter(f => f.trim() !== '')

      const { error } = await supabase
        .from('products')
        .update({
          product_name: formData.product_name,
          product_type: formData.product_type,
          description: formData.description,
          pricing_model: formData.pricing_model,
          product_price: formData.product_price ? parseFloat(formData.product_price) : 0,
          features: featuresArray,
          duration: formData.duration,
          thumbnail_url: formData.thumbnail_url || null,
          sales_page_url: formData.sales_page_url || null,
          is_active: formData.is_active
        })
        .eq('id', selectedProduct.id)

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      await fetchProducts()
      setView('list')
      resetForm()
    } catch (error: any) {
      console.error('Failed to update product:', error)
      alert(`Failed to update product: ${error.message || 'Please try again.'}`)
    }
  }

  const handleDeleteProduct = async (id: string, productId: string) => {
    if (confirm(`Are you sure you want to delete product ${productId}?`)) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id)

        if (error) throw error
        await fetchProducts()
      } catch (error) {
        console.error('Failed to delete product:', error)
        alert('Failed to delete product. Please try again.')
      }
    }
  }

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product)
    setView('view')
  }

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product)
    setFormData({
      product_name: product.product_name,
      product_type: product.product_type,
      description: product.description,
      pricing_model: product.pricing_model,
      product_price: product.product_price.toString(),
      features: Array.isArray(product.features) ? product.features.join('\n') : '',
      duration: product.duration,
      thumbnail_url: product.thumbnail_url || '',
      sales_page_url: product.sales_page_url || '',
      is_active: product.is_active
    })
    setView('edit')
  }

  const resetForm = () => {
    setFormData({
      product_name: '',
      product_type: '',
      description: '',
      pricing_model: '',
      product_price: '',
      features: '',
      duration: '',
      thumbnail_url: '',
      sales_page_url: '',
      is_active: true
    })
    setSelectedProduct(null)
  }

  return (
    <>
      {/* Hide TopNav on mobile for add/edit/view */}
      <style>{`
        ${view !== 'list' ? '@media (max-width: 768px) { header { display: none !important; } }' : ''}
      `}</style>

      <div className="ppt-slide md:p-6">
      {/* Desktop View */}
      <div className="hidden md:block">
        {view === 'list' && (
          <>
            <PageHeader
              title="Products Master"
              subtitle="Manage CA Practice Services - Registration, Compliance & Licensing"
              actions={[
                {
                  label: 'Add Product',
                  onClick: () => setView('add'),
                  variant: 'default',
                  icon: Plus
                }
              ]}
            />
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <KPICard
                  title="Total Products"
                  value={totalProducts}
                  change={12}
                  icon={Package}
                  category="primary"
                />
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <KPICard
                  title="Active Products"
                  value={activeProducts}
                  change={5}
                  icon={TrendingUp}
                  category="success"
                />
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <KPICard
                  title="Total Sales"
                  value={totalSales}
                  change={18}
                  icon={ShoppingCart}
                  category="secondary"
                />
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <KPICard
                  title="Total Revenue"
                  value={`₹${totalRevenue.toLocaleString()}`}
                  change={25}
                  icon={DollarSign}
                  category="success"
                />
              </motion.div>
            </motion.div>

            <motion.div
              className="mb-6 flex gap-4 flex-wrap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Input
                placeholder="Search products by ID, name, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <select
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Business Registration">Business Registration</option>
                <option value="Statutory Compliance">Statutory Compliance</option>
                <option value="Business License">Business License</option>
              </select>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>All Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Product</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Type</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Pricing</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Sales</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-500">Loading products...</td>
                          </tr>
                        ) : filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-500">No products found</td>
                          </tr>
                        ) : (
                          filteredProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  {product.product_type === 'Business Registration' ? (
                                    <Briefcase className="w-5 h-5 text-blue-600" />
                                  ) : product.product_type === 'Statutory Compliance' ? (
                                    <GraduationCap className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <Package className="w-5 h-5 text-purple-600" />
                                  )}
                                  <div>
                                    <div className="font-medium">{product.product_name}</div>
                                    <div className="text-sm text-gray-500 font-mono">{product.product_id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge className={productTypeColors[product.product_type]}>
                                  {product.product_type}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  {product.pricing_model === 'One-Time' && (
                                    <div className="text-sm">
                                      <span className="font-semibold text-brand-primary">₹{product.product_price.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {product.pricing_model === 'Recurring' && (
                                    <div className="text-sm">
                                      <span className="font-semibold text-brand-primary">₹{product.product_price.toLocaleString()}/mo</span>
                                    </div>
                                  )}
                                  <Badge variant="outline" className={pricingModelColors[product.pricing_model]}>
                                    {product.pricing_model}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="font-semibold">{product.total_sales} units</div>
                                  <div className="text-sm text-gray-600">₹{parseFloat(product.total_revenue.toString()).toLocaleString()}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge className={product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                  {product.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditClick(product)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteProduct(product.id, product.product_id)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {(view === 'add' || view === 'edit') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{view === 'add' ? 'Add Product' : 'Edit Product'}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setView('list'); resetForm(); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                      <Input
                        value={formData.product_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                        placeholder="Enter product name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Product Type *</label>
                      <Select value={formData.product_type} onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Business Registration">Business Registration</SelectItem>
                          <SelectItem value="Statutory Compliance">Statutory Compliance</SelectItem>
                          <SelectItem value="Business License">Business License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter product description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Model *</label>
                      <Select value={formData.pricing_model} onValueChange={(value) => setFormData(prev => ({ ...prev, pricing_model: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pricing model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="One-Time">One-Time</SelectItem>
                          <SelectItem value="Recurring">Recurring</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Price
                        {formData.pricing_model === 'Recurring' && <span className="text-xs text-gray-500 ml-1">(Monthly)</span>}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.product_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, product_price: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Features (one per line)</label>
                    <Textarea
                      value={formData.features}
                      onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                      placeholder="Enter features, one per line"
                      rows={5}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                      <Input
                        value={formData.duration}
                        onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                        placeholder="e.g., 6 weeks, 3 months"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                      <Input
                        value={formData.thumbnail_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sales Page URL</label>
                      <Input
                        value={formData.sales_page_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, sales_page_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mt-6">
                    <Button
                      onClick={view === 'add' ? handleCreateProduct : handleEditProduct}
                      disabled={!formData.product_name || !formData.product_type || !formData.pricing_model}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {view === 'add' ? 'Add Product' : 'Save Changes'}
                    </Button>
                    <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {view === 'view' && selectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Product Details</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    {selectedProduct.product_type === 'Business Registration' ? (
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Briefcase className="w-8 h-8 text-blue-600" />
                      </div>
                    ) : selectedProduct.product_type === 'Statutory Compliance' ? (
                      <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
                        <GraduationCap className="w-8 h-8 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Package className="w-8 h-8 text-purple-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold">{selectedProduct.product_name}</h3>
                      <p className="text-sm text-gray-500 font-mono">{selectedProduct.product_id}</p>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-2">Description</div>
                    <p className="text-base">{selectedProduct.description || 'N/A'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Product Type</div>
                      <Badge className={productTypeColors[selectedProduct.product_type]}>
                        {selectedProduct.product_type}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Status</div>
                      <Badge className={selectedProduct.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {selectedProduct.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-2">Duration</div>
                    <div className="text-base">{selectedProduct.duration || 'N/A'}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-2">Pricing</div>
                    <div className="bg-blue-50 p-4 rounded">
                      <div className="text-sm text-gray-600">
                        {selectedProduct.pricing_model === 'One-Time' ? 'One-Time Price' : 'Monthly Price'}
                      </div>
                      <div className="text-2xl font-bold text-brand-primary">
                        ₹{selectedProduct.product_price.toLocaleString()}{selectedProduct.pricing_model === 'Recurring' && '/mo'}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(selectedProduct.features) && selectedProduct.features.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Features</div>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedProduct.features.map((feature, index) => (
                          <li key={index} className="text-sm">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Created</div>
                        <div>{new Date(selectedProduct.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Last Updated</div>
                        <div>{new Date(selectedProduct.updated_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-6">
                  <Button onClick={() => { handleEditClick(selectedProduct); }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Product
                  </Button>
                  <Button variant="outline" onClick={() => setView('list')}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Mobile Header */}
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-1">Products</h1>
                <p className="text-cyan-100 text-sm">{totalProducts} products • ₹{totalRevenue.toLocaleString()} revenue</p>
              </div>

              {/* Stats Cards */}
              <div className="px-4 -mt-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-cyan-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-cyan-100 p-2 rounded-xl">
                        <Package className="w-5 h-5 text-cyan-600" />
                      </div>
                      <span className="text-2xl font-bold text-cyan-600">{totalProducts}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Total</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-2xl font-bold text-green-600">{activeProducts}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Active</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <ShoppingCart className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-2xl font-bold text-blue-600">{totalSales}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Sales</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-purple-100 p-2 rounded-xl">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="text-xl font-bold text-purple-600">₹{(totalRevenue / 1000).toFixed(0)}k</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Revenue</p>
                  </motion.div>
                </div>
              </div>

              {/* Add Product Button */}
              <div className="px-4 mb-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('add')}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Add New Product
                </motion.button>
              </div>

              {/* Products List */}
              <div className="px-4 pb-20">
                <h2 className="text-lg font-bold text-gray-800 mb-3">All Products</h2>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No products yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProducts.map((product) => (
                      <motion.div
                        key={product.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleViewProduct(product)}
                        className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 mb-1">{product.product_name}</p>
                            <p className="text-xs text-gray-500 font-mono mb-2">{product.product_id}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={productTypeColors[product.product_type]}>
                                {product.product_type}
                              </Badge>
                              <Badge className={product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {product.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="text-lg font-bold text-cyan-600">
                            ₹{product.product_price.toLocaleString()}{product.pricing_model === 'Recurring' && '/mo'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {product.total_sales || 0} sales
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(view === 'add' || view === 'edit') && (
            <motion.div
              key="form"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => { setView('list'); resetForm(); }}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-2xl font-bold">
                    {view === 'add' ? 'Add Product' : 'Edit Product'}
                  </h1>
                </div>
              </div>

              <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                <Input
                  value={formData.product_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Type *</label>
                <Select value={formData.product_type} onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Business Registration">Business Registration</SelectItem>
                    <SelectItem value="Statutory Compliance">Statutory Compliance</SelectItem>
                    <SelectItem value="Business License">Business License</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Model *</label>
                <Select value={formData.pricing_model} onValueChange={(value) => setFormData(prev => ({ ...prev, pricing_model: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pricing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="One-Time">One-Time</SelectItem>
                    <SelectItem value="Recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price {formData.pricing_model === 'Recurring' && '(Monthly)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.product_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Features (one per line)</label>
                <Textarea
                  value={formData.features}
                  onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                  placeholder="Enter features"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <Input
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 6 weeks"
                />
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  onClick={view === 'add' ? handleCreateProduct : handleEditProduct}
                  disabled={!formData.product_name || !formData.product_type || !formData.pricing_model}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {view === 'add' ? 'Add Product' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => { setView('list'); resetForm(); }} className="w-full">
                  Cancel
                </Button>
              </div>
              </div>
            </motion.div>
          )}

          {view === 'view' && selectedProduct && (
            <motion.div
              key="view"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('list')}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-2xl font-bold">Product Details</h1>
                </div>
              </div>

              <div className="p-4 space-y-4 pb-20">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold mb-1">{selectedProduct.product_name}</h2>
                      <p className="text-sm text-gray-500 font-mono">{selectedProduct.product_id}</p>
                    </div>
                    {selectedProduct.product_type === 'Business Registration' ? (
                      <Briefcase className="w-8 h-8 text-blue-600" />
                    ) : selectedProduct.product_type === 'Statutory Compliance' ? (
                      <GraduationCap className="w-8 h-8 text-green-600" />
                    ) : (
                      <Package className="w-8 h-8 text-purple-600" />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Description</div>
                      <div className="text-sm">{selectedProduct.description || 'N/A'}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Type</div>
                        <Badge className={productTypeColors[selectedProduct.product_type]} variant="secondary">
                          {selectedProduct.product_type}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Status</div>
                        <Badge className={selectedProduct.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {selectedProduct.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-600 mb-1">Price</div>
                      <div className="text-2xl font-bold text-brand-primary">
                        ₹{selectedProduct.product_price.toLocaleString()}{selectedProduct.pricing_model === 'Recurring' && '/mo'}
                      </div>
                      <Badge variant="outline" className={pricingModelColors[selectedProduct.pricing_model]}>
                        {selectedProduct.pricing_model}
                      </Badge>
                    </div>

                    {Array.isArray(selectedProduct.features) && selectedProduct.features.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Features</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedProduct.features.map((feature, index) => (
                            <li key={index}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-gray-600 mb-1">Duration</div>
                      <div className="text-sm">{selectedProduct.duration || 'N/A'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button onClick={() => handleEditClick(selectedProduct)} className="w-full">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Product
                </Button>
                <Button variant="outline" onClick={() => setView('list')} className="w-full">
                  Close
                </Button>
              </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  )
}
