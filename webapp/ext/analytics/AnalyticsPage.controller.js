sap.ui.define([
    "sap/fe/core/PageController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Item",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (PageController, JSONModel, Item, FeedItem) {
    "use strict";

    return PageController.extend("maintnoti.maint.ext.analytics.AnalyticsPage", {

        onInit: function () {
            PageController.prototype.onInit.apply(this, arguments);
            this._dataLoaded = false;
            this._rawData    = [];
            var oView = this.getView();
            oView.setModel(new JSONModel({ count: 0, totalHours: 0, openCount: 0 }), "kpi");
            oView.setModel(new JSONModel({ data: [] }), "chartStatus");
            oView.setModel(new JSONModel({ data: [] }), "chartPriority");
        },

        onAfterRendering: function () {
            if (PageController.prototype.onAfterRendering) {
                PageController.prototype.onAfterRendering.apply(this, arguments);
            }
            if (this._dataLoaded) { return; }
            var oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                this._dataLoaded = true;
                this._loadAllData(oModel);
            }
        },

        _loadAllData: function (oModel) {
            var that     = this;
            var oView    = this.getView();
            var oBinding = oModel.bindList("/MaintNotificationAnal");

            oBinding.requestContexts(0, 500).then(function (aCtx) {
                if (oView.bIsDestroyed) { return; }

                that._rawData = aCtx.map(function (ctx) {
                    return {
                        status:       ctx.getProperty("Status")       || "?",
                        statusText:   ctx.getProperty("StatusText")   || ctx.getProperty("Status") || "?",
                        priority:     ctx.getProperty("Priority")     || "?",
                        priorityText: ctx.getProperty("PriorityText") || ctx.getProperty("Priority") || "?",
                        slaHours:     parseFloat(ctx.getProperty("SlaHours") || 0)
                    };
                });

                that._populateFilters();
                that._applyFilters();

            }).catch(function () {}).finally(function () { oBinding.destroy(); });
        },

        _populateFilters: function () {
            var oView       = this.getView();
            var oStatusSel  = oView.byId("filterStatus");
            var oPrioritySel= oView.byId("filterPriority");

            // Keep first "All" item, remove the rest
            while (oStatusSel.getItems().length > 1)   { oStatusSel.removeItem(1); }
            while (oPrioritySel.getItems().length > 1)  { oPrioritySel.removeItem(1); }

            var statusSeen = {}, prioritySeen = {};
            this._rawData.forEach(function (row) {
                if (!statusSeen[row.status]) {
                    statusSeen[row.status] = true;
                    oStatusSel.addItem(new Item({ key: row.status, text: row.statusText }));
                }
                if (!prioritySeen[row.priority]) {
                    prioritySeen[row.priority] = true;
                    oPrioritySel.addItem(new Item({ key: row.priority, text: row.priorityText }));
                }
            });
        },

        _applyFilters: function () {
            var oView      = this.getView();
            var sStatus    = oView.byId("filterStatus").getSelectedKey();
            var sPriority  = oView.byId("filterPriority").getSelectedKey();

            var aFiltered = this._rawData.filter(function (row) {
                return (!sStatus   || row.status   === sStatus) &&
                       (!sPriority || row.priority === sPriority);
            });

            var total = 0, openCount = 0;
            var statusMap = {}, priorityMap = {};

            aFiltered.forEach(function (row) {
                total += row.slaHours;
                if (row.status === "101") { openCount++; }

                if (!statusMap[row.status]) {
                    statusMap[row.status] = { StatusText: row.statusText, SlaHours: 0 };
                }
                if (!priorityMap[row.priority]) {
                    priorityMap[row.priority] = { PriorityText: row.priorityText, SlaHours: 0 };
                }
                statusMap[row.status].SlaHours    += row.slaHours;
                priorityMap[row.priority].SlaHours += row.slaHours;
            });

            oView.getModel("kpi").setData({ count: aFiltered.length, totalHours: total, openCount: openCount });
            oView.getModel("chartStatus").setProperty("/data",   Object.values(statusMap));
            oView.getModel("chartPriority").setProperty("/data", Object.values(priorityMap));
        },

        onFilterChange: function () {
            this._applyFilters();
        },

        onResetFilters: function () {
            var oView = this.getView();
            oView.byId("filterStatus").setSelectedKey("");
            oView.byId("filterPriority").setSelectedKey("");
            this._applyFilters();
        },

        onChartTypeChange: function (oEvent) {
            var sKey      = oEvent.getParameter("item").getKey();
            var sId       = oEvent.getSource().getId();
            var bStatus   = sId.indexOf("typeStatusBtn") !== -1;
            var oViz      = this.byId(bStatus ? "vizStatus" : "vizPriority");
            var sDimLabel = bStatus ? "Status" : "Priority";

            oViz.setVizType(sKey);
            oViz.removeAllFeeds();

            if (sKey === "pie" || sKey === "donut") {
                oViz.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: [sDimLabel] }));
                oViz.addFeed(new FeedItem({ uid: "size",  type: "Measure",   values: ["SLA Hours"] }));
            } else {
                oViz.addFeed(new FeedItem({ uid: "valueAxis",    type: "Measure",   values: ["SLA Hours"] }));
                oViz.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: [sDimLabel] }));
            }
        }
    });
});
