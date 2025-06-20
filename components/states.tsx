"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, CheckCircle } from "lucide-react"
import { motion } from "framer-motion"

export function States() {
  const states = [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
  ]

  const regions = [
    {
      name: "West Coast",
      states: ["California", "Oregon", "Nevada", "Arizona"],
      color: "bg-blue-100 text-blue-800",
    },
    {
      name: "Southwest",
      states: ["Arizona", "New Mexico", "Colorado", "Utah"],
      color: "bg-green-100 text-green-800",
    },
    {
      name: "Midwest",
      states: [
        "Illinois",
        "Indiana",
        "Iowa",
        "Kansas",
        "Michigan",
        "Minnesota",
        "Missouri",
        "Nebraska",
        "North Dakota",
        "Ohio",
      ],
      color: "bg-purple-100 text-purple-800",
    },
    {
      name: "Southeast",
      states: ["Alabama", "Arkansas", "Florida", "Georgia", "Kentucky", "Louisiana", "Mississippi", "North Carolina"],
      color: "bg-orange-100 text-orange-800",
    },
    {
      name: "Northeast",
      states: [
        "Connecticut",
        "Delaware",
        "Maine",
        "Maryland",
        "Massachusetts",
        "New Hampshire",
        "New Jersey",
        "New York",
      ],
      color: "bg-red-100 text-red-800",
    },
    {
      name: "Mountain West",
      states: ["Colorado", "Idaho", "Montana", "Nevada"],
      color: "bg-yellow-100 text-yellow-800",
    },
  ]

  return (
    <section id="states" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Nationwide Coverage</h2>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Licensed and certified to serve clients in over 35 states across the United States. Wherever you are, I can
            help you find the right insurance coverage.
          </p>
        </motion.div>

        {/* Regional Coverage */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {regions.map((region, index) => (
            <motion.div
              key={region.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {region.name}
                    <Badge className={region.color}>{region.states.length} States</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {region.states.map((state) => (
                      <div key={state} className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                        {state}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* All States List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gray-50 rounded-2xl p-8"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Complete State Coverage List</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {states.map((state, index) => (
              <motion.div
                key={state}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.02 }}
                className="flex items-center bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">{state}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
