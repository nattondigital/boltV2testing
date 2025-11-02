import React, { useRef, useState, useEffect } from 'react'
import { X, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface InvoicePDFProps {
  invoice: any
  onClose: () => void
}

interface BusinessSettings {
  business_name: string
  business_tagline: string
  business_address: string
  business_city: string
  business_state: string
  business_pincode: string
  business_phone: string
  business_email: string
  gst_number: string
  website: string
}

export function InvoicePDF({ invoice, onClose }: InvoicePDFProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null)

  useEffect(() => {
    loadBusinessSettings()
  }, [])

  const loadBusinessSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setBusinessSettings(data)
      }
    } catch (error) {
      console.error('Error loading business settings:', error)
    }
  }

  const generatePDF = async () => {
    if (!invoiceRef.current) return

    const element = invoiceRef.current

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
    const imgX = (pdfWidth - imgWidth * ratio) / 2
    const imgY = 0

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
    pdf.save(`Invoice-${invoice.invoice_id}.pdf`)
  }

  const handlePrint = () => {
    window.print()
  }

  const items = invoice.items || []
  const invoiceDate = new Date(invoice.issue_date)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10 rounded-t-lg print:hidden">
          <h2 className="text-xl font-semibold text-gray-900">Invoice Preview</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button onClick={generatePDF} className="bg-sky-600 hover:bg-sky-700">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={onClose} variant="outline" size="icon">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-8">
          <Card ref={invoiceRef} className="p-12 bg-white invoice-container">
            <div className="space-y-8">
              <div className="border-b-2 border-sky-600 pb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-sky-600 mb-2">
                      {businessSettings?.business_name || 'YOUR COMPANY NAME'}
                    </h1>
                    <p className="text-sm text-gray-600">
                      {businessSettings?.business_tagline || 'Your Business Tagline'}
                    </p>
                    <div className="mt-4 text-sm text-gray-600 space-y-1">
                      <p>{businessSettings?.business_address || '123 Business Street'}</p>
                      <p>
                        {businessSettings?.business_city || 'City'} - {businessSettings?.business_pincode || '123456'}, {businessSettings?.business_state || 'State'}
                      </p>
                      <p>Phone: {businessSettings?.business_phone || '+91 98765 43210'}</p>
                      <p>Email: {businessSettings?.business_email || 'info@company.com'}</p>
                      {businessSettings?.gst_number && <p>GST: {businessSettings.gst_number}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-bold text-gray-800 mb-2">INVOICE</h2>
                    <div className="mt-4 text-sm space-y-1">
                      <p className="font-semibold">Invoice #: {invoice.invoice_id}</p>
                      <p>Date: {invoiceDate.toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                      <p>Order ID: {invoice.id?.substring(0, 8) || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Bill To:</h3>
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-gray-900 text-base">{invoice.customer_name}</p>
                    {invoice.customer_email && <p className="text-gray-600">{invoice.customer_email}</p>}
                    {invoice.customer_phone && <p className="text-gray-600">Phone: {invoice.customer_phone}</p>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Payment Details:</h3>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="font-medium">{invoice.payment_method || 'Online Payment'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className={`font-semibold ${
                        invoice.status === 'Paid' ? 'text-green-600' :
                        invoice.status === 'Overdue' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {invoice.status === 'Paid' ? '✓ Paid' : invoice.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="font-medium">{formatDate(invoice.due_date)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {invoice.title && (
                <div className="bg-gray-50 px-4 py-3 rounded-lg">
                  <p className="font-semibold text-gray-900">{invoice.title}</p>
                </div>
              )}

              <div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-3 px-2 text-sm font-bold text-gray-700 uppercase tracking-wide">Item Description</th>
                      <th className="text-center py-3 px-2 text-sm font-bold text-gray-700 uppercase tracking-wide">Qty</th>
                      <th className="text-right py-3 px-2 text-sm font-bold text-gray-700 uppercase tracking-wide">Unit Price</th>
                      <th className="text-right py-3 px-2 text-sm font-bold text-gray-700 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? items.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-4 px-2">
                          <div>
                            <p className="font-medium text-gray-900">{item.product_name || item.description || item.name}</p>
                            {item.description && item.product_name && (
                              <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                            )}
                            {item.details && (
                              <p className="text-xs text-gray-600 mt-1">{item.details}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center text-gray-900">{item.quantity || 1}</td>
                        <td className="py-4 px-2 text-right text-gray-900">{formatCurrency(item.unit_price || item.rate || item.price || 0)}</td>
                        <td className="py-4 px-2 text-right font-semibold text-gray-900">
                          {formatCurrency(item.total || ((item.quantity || 1) * (item.unit_price || item.rate || item.price || 0)))}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-500">No items</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-96 space-y-3">
                  <div className="flex justify-between py-2 text-sm border-b border-gray-200">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                  </div>

                  {parseFloat(invoice.discount) > 0 && (
                    <div className="flex justify-between py-2 text-sm border-b border-gray-200">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-medium text-green-600">-{formatCurrency(invoice.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 text-sm border-b border-gray-200">
                    <span className="text-gray-600">Tax ({invoice.tax_rate}%):</span>
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.tax_amount)}</span>
                  </div>

                  <div className="flex justify-between py-4 border-t-2 border-sky-600">
                    <span className="text-xl font-bold text-gray-900">Total Amount:</span>
                    <span className="text-2xl font-bold text-sky-600">{formatCurrency(invoice.total_amount)}</span>
                  </div>

                  {invoice.status === 'Paid' ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-green-800">✓ Payment Received</p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-yellow-800">Total Amount:</span>
                          <span className="font-semibold text-yellow-900">{formatCurrency(invoice.total_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-800">Amount Paid:</span>
                          <span className="font-semibold text-green-600">{formatCurrency(invoice.paid_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-yellow-300">
                          <span className="font-bold text-red-800">Balance Due:</span>
                          <span className="text-lg font-bold text-red-600">{formatCurrency(invoice.balance_due || invoice.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t-2 border-gray-200 pt-6 space-y-4">
                {invoice.notes && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Notes:</h3>
                    <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                      {invoice.notes}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Terms & Conditions:</h3>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                    <li>Payment is due within the specified due date</li>
                    <li>Late payments may incur additional charges</li>
                    <li>Please include invoice number with your payment</li>
                    <li>For queries, contact us at the details provided above</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="text-center space-y-2">
                  <p className="text-base font-semibold text-gray-900">Thank you for your business!</p>
                  <p className="text-xs text-gray-600">
                    This is a computer-generated invoice and does not require a signature.
                  </p>
                  <p className="text-xs text-gray-500 mt-4">
                    {businessSettings?.business_name || 'Your Company'} • {businessSettings?.website || 'www.company.com'} • Quality Service Since 2020
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <div className="text-center">
                  <div className="border-t-2 border-gray-400 w-48 mb-2"></div>
                  <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Authorized Signature</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
        </div>
      </div>
    </div>
  )
}
