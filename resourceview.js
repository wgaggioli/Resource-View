(function($, undefined) {
    var defaults = {
        days: 7,
        date_start: new Date(),
        resource_label: 'Resources',
		double_left_nav: '&lt;&lt;',
		left_nav: '&lt;',
		double_right_nav: '&gt;&gt;',
		right_nav: '&gt;',
		date_picker: 'Choose Date',
		selectable: true
    };

	$.fn.resourceView = function(options){
		/*
		 * 		  Options
		 *
		 *  resources       array of objects with name and id attributes
		 *  resource_label  label to put in the table head above the resources
		 *                  (default Resources)
		 *  events          array of objects with the following attributes:
		 *                      * resource_id
		 *                      * date_start
		 *                      * date_end
		 *                      * display (optional): html to display for event
		 *                      * top (optional): boolean, may not use this
		 *  events_url      url to which to make an ajax request to collect events
		 *                  array, which must be accessable via 'events' property
		 *                  of the response
		 *  render_event	function to call that returns the html al dentro de
		 *  				un event (default will look for display html)
		 *  cell_content	function to call that returns the contents of a cell
         *  date_start      start date to use for calendar
         *  days            number of days displayed at a time
         *  fetch_data		data to include in ajax request to fetch events. If
         *  				a callable, is called to obtain the data.
         *  left_nav		html content of left nav button
		 *  right_nav		html content of right nav button
		 *  double_left_nav 	content of double left nav
		 *  double_right_nav	content of double right nav
		 *  date_picker		html content of date picker buttons
		 *  selectable		mimics jquery ui's selectable behavior for cells
		 *  resizable		allows extension along left, right (requires
		 *  				jquery-ui resizable)
		 *  draggable		allows drag and drop of events
		 *  event_click		function triggered on event click
		 *  cell_select		function triggered on cell select
		 *  cell_deselect   function triggered on cell deselect
		 *  on_resize		function triggered on event resize
		 *  resize_start	function triggered on start of resize
		 *  on_drag			function triggered when cell is dragged
		 *  drag_start		function triggered on start of drag
		 *  on_over			function triggered on mouse over
		 *  on_out			function triggered on mouse out
		 */

        options = $.extend(true, {},
            defaults,
            {},
            options
        );

		this.each(function(i,e){
			var element = $(e);
			var resource_view = new ResourceView(element, options);
			element.data('resourceView', resource_view);
			resource_view.render();
		});

		return this;
	};


    function ResourceView(element, options){
        var t = this;

        // exports
        t.render = render;
		t.fetchEvents = fetchEvents;
		t.reRenderEvents = reRenderEvents;
		t.getDateAtIndex = getDateAtIndex;
		t.clearCache = clearCache;
        t.event_defaults = {
            top: true
        };
		t.days = options.days;
        t.events_url = options.events_url;
        t.resources = options.resources;
        t.resource_label = options.resource_label;
		t.left_nav = options.left_nav;
		t.right_nav = options.right_nav;
		t.double_left_nav = options.double_left_nav;
		t.double_right_nav = options.double_right_nav;
		t.fetch_data = options.fetch_data;
		t.selectable = options.selectable;
		t.resizable = options.resizable;
		t.draggable = options.draggable;

		// functions
		var render_event = options.render_event ? options.render_event : defaultEventRender;

        // locals
		var date_start = options.date_start;
		var events = options.events || [];
        var content;
		var date_picker;
        var table;
        var date_head;
        var resource_rows;
		var table_body;
        var dates;
		var event_container;
		var hcache;
		var vcache;
		var leftEdge;
		var rightEdge;
		var eventClick = options.event_click || function(){ return false; };
		var onOver = options.on_over;
		var onOut = options.on_out;
		var onCellSelect = options.cell_select || function(){ return false; };
		var onCellDeselect = options.cell_deselect || function() { return false; };
		var on_resize = options.on_resize;
		var resizeStart = options.resize_start;
		var dragStart = options.drag_start;
		var on_drag = options.on_drag;
		var cellContent = options.cell_content;
		var mouse_down = false;
		var mouse_down_ev;
		var select_box;

        function render(){
			clearCache();
            if (!content){
                initialRender();
            } else{
                reRenderCalendar();
                reRenderResources();
            }
            if (events.length){
				reRenderEvents();
            } else if (t.events_url){
				fetchEvents();
			} else{
                clearEvents();
            }
        }

		function clearCache(){
			hcache = new HorizontalPositionCache(function(col){
				return date_head.find('th:eq(' + col + ')');
			});
			vcache = {};
		}
        function initialRender(){
            content = $("<div class='rv-content' style='position:relative'/>")
				.append($("<div class='rv-navigation'/>")
					.append($('<a class="rv-page-left" href="#"/>')
						.click(scrollPageLeft)
						.html(t.double_left_nav))
					.append($('<a class="rv-day-left" href="#"/>')
						.click(scrollDayLeft)
						.html(t.left_nav))
					.append($('<div class="rv-date-picker"/>')
						.text(reservationlabels['starting_date'] || 'Starting Date')
						.append(date_picker = $('<input type="date" value="' + formatDate(date_start) + '"/>')
							.dateinput({format:'yyyy-mm-dd'})
							.change(datePick)))
					.append($('<a class="rv-day-right" href="#"/>')
						.click(scrollDayRight)
						.html(t.right_nav))
					.append($('<a class="rv-page-right" href="#"/>')
						.click(scrollPageRight)
						.html(t.double_right_nav)))
				.append($("<table/>")
					.append(date_head = $("<thead/>")
						.html(renderCalendarRow()))
					.append(table_body = renderResources()))
				.append(event_container = $('<div/>'))
				.prependTo(element);
			rightEdge = content.width();
			leftEdge = date_head.find('th:eq(1)').position().left;
        }

		function reRenderCalendar(){
			clearDates();
			date_head.html(renderCalendarRow());
		}

        function renderCalendarRow(){
            calcDates();
            var row = $("<tr/>");
            row.append($("<th class='rv-resource'>" + t.resource_label + "</th>"));
            $.each(dates, function(i, d){
                row.append($("<th>" + formatDate(d) + "</th>"));
            });
            return row;
        }

		function getDateAtIndex(i){
			return dates[i];
		}

        // Steal from fullcalendar if we ever wanna get fancy here
        function formatDate(d){
            return d.getFullYear() + '-' + padzeros((d.getMonth()+1)) + '-' + padzeros(d.getDate());
        }

		function parseDate(d, debug){
			m = d.match(/(\d\d\d\d)-(\d+)-(\d+)/);
			return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
		}

		function padzeros(i,n){
			if (!n){n = 2;}
			i_str = String(i);
			if (i_str.length<n){
				i_str = '0' + i_str;
			}
			return i_str;
		}

		function reRenderResources(){
			table_body.replace(renderResources());
		}

        function renderResources(){
            resource_rows = {};
            var body = $("<tbody/>");
            $.each(t.resources, function(i, r){
                var this_row = $('<tr class="rv-resource_row rv-resource-' + r.id + '"/>')
                    .append($('<td class="rv-resource rv-resource_label"/>')
                        .html('<div class="rv-spacer">&nbsp;</div><span class="rv-label-text">' + r.name + '</span>'));
                for (j=0; j<t.days; j++){
                    this_row.append($('<td class="rv-date-' + j + '"/>')
						.mousedown(cellDown)
						.mouseup(cellUp)
						.click(cellClick)
						.html(renderCellContent(r.id)));
                }
                resource_rows[r.id] = this_row;
                body.append(this_row);
            });
            return body;
        }

		function renderCellContent(resource_id, date){
			html = typeof cellContent === 'function' ? cellContent(resource_id) : '';
			return html;
		}

		function cellDown(ev){
			if (t.selectable){
				mouse_down = this;
				mouse_down_ev = ev;
			}
		}

		function cellUp(ev){
			if (mouse_down && t.selectable && mouse_down !== this){
				var cells = new Array();
				var row = this.parentNode;
				var index0 = parseInt(mouse_down.className.match(/rv-date-(\d+)/)[1]);
				var index1 = parseInt(this.className.match(/rv-date-(\d+)/)[1]);
				if (index0 > index1){
					var temp = index1;
					index1 = index0 + 2;
					index0 = temp + 1;
				} else{
					index0 += 1;
					index1 += 2;
				}
				var up = ev.pageY > mouse_down_ev.pageY;
				while (true){
					// loop through row
					cells = cells.concat($.makeArray($(row).children().slice(index0, index1)));
					if (row === mouse_down.parentNode){
						break;
					}
					row = up ? row.previousSibling : row.nextSibling;
				}
				if (!mouse_down_ev.shiftKey){
					unselect();
				} else if (cells.length === 1 && $(this).hasClass('rv-selected')){
					$(this).removeClass('rv-selected');
					onCellDeselect(this);
					return false;
				}
				$(cells).addClass('rv-selected').each(function(){
					onCellSelect(this);
				});
			}
			mouse_down = false;
			if (select_box){
				select_box.remove();
				select_box = null;
				table_body.unbind('mousemove');
			}
		}

		function cellClick(ev){
			if (t.selectable){
				if (!ev.shiftKey){
					unselect();
				} else if ($(this).hasClass('rv-selected')){
					$(this).removeClass('rv-selected');
					onCellDeselect(this);
					return false;
				}
				$(this).addClass('rv-selected');
				onCellSelect(this);
			}
		}

		function unselect(){
			table_body.find('td').each(function(){
				$(this).removeClass('rv-selected');
				onCellDeselect(this);
			});
		}

		function clearDates(){
			date_head.children('td').text('');
		}

        function calcDates(){
            dates = new Array();
            var date = date_start;
            for (i=0; i<t.days; i++){
                dates.push(date);
                date = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1);
            }
        }

		function datePick(e, d){
			date_start = d;
			reRenderCalendar();
			fetchEvents();
		}

		function setDateStart(d){
			date_start = d;
			date_picker.data('dateinput').setValue(d);
		}

		function shiftDate(shift){
			date_start.setDate(date_start.getDate()+shift);
			date_picker.data('dateinput').setValue(date_start);
			if (t.selectable){
				shiftSelects(shift);
			}
		}

		function shiftSelects(shift){
			table_body.find('td.rv-selected').each(function(){
				$(this).removeClass('rv-selected');
				onCellDeselect(this);
				var newSelected = shift < 0 ? $(this).nextAll().eq(-shift-1) : $(this).prevAll().not('.rv-resource_label').eq(shift-1);
				if (newSelected.length){
					newSelected.addClass('rv-selected');
				}
			});
		}

		function scrollPageLeft(){
			shiftDate(-t.days);
			return false;
		}

		function scrollDayLeft(){
			shiftDate(-1);
			return false;
		}

		function scrollPageRight(){
			shiftDate(t.days);
			return false;
		}

		function scrollDayRight(){
			shiftDate(1);
			return false;
		}

		function fetchEvents(){
			if (t.events_url){
				clearEvents();
				$.ajax({
					url: t.events_url,
					data: getPostData(),
					type: 'POST',
					success: function(response){
						if (response.success){
							setEvents(response.events);
							renderEvents();
						} else{
							alert(response.msg);
						}
					}
				})
			}
        }

		function getPostData(){
			var data = {
				start: formatDate(date_start),
				days: t.days
			}
			if (typeof t.fetch_data === 'object'){
				data = $.extend(data, t.fetch_data);
			} else if (typeof t.fetch_data === 'function'){
				data = $.extend(data, t.fetch_data());
			}
			return data;
		}

        function setEvents(new_events){
			events = new_events;
        }

		function reRenderEvents(){
			// NOTE: change this to be smarter in the future, but right now
			// event data is re-fetched on drag/drop/resize
			//clearEvents();
			//renderEvents();
			fetchEvents();
		}

        function renderEvents(){
			var min_width = hcache.pos(2) - hcache.pos(1);
			$.each(events, function(i, event){
				var event_coords = getEventCoordinates(event);
				var rv = {
					at_edge_left: event_coords.at_edge_left,
					at_edge_right: event_coords.at_edge_right
				}
				var event_render = $('<div class="rv-event-cont"/>')
						.css('position','absolute')
						.css('left',event_coords.left+'px')
						.css('top',event_coords.top+'px')
						.css('width',event_coords.width+'px')
						.append(render_event(event, rv)
							.click(eventClick))
						.data('rv-resource',event.resource_id);
				if (typeof onOver === 'function'){
					event_render.mouseenter(onOver);
				}
				if (typeof onOut === 'function'){
					event_render.mouseleave(onOut);
				}
				if (t.resizable && event.resize !== false){
					event_render.resizable({
						handles: 'e,w',
						distance: 10,
						containment: table,
						minWidth: min_width,
						grid: [min_width, null],
						start: resizeStart,
						stop: eventResize
					});
				}
				if (t.draggable && event.drag !== false){
					var min_height = getResourceTop(t.resources[2].id) - getResourceTop(t.resources[1].id);
					event_render.draggable({
						distance: 10,
						containment: table,
						grid: [min_width, min_height],
						start: dragStart,
						stop: eventDrag
					});
				}
				event_container.append(event_render);
			});
        }

		function eventResize(ev, ui){
			var event = this;
			var linked = $(event).data('rv-resize_linked');
			if (linked !== undefined && linked !== null){
				linked.offset({left: $(event).offset().left});
				linked.width($(event).width());
				$(event).data('rv-resize_linked', null);
			}
			if (on_resize){
				data = {resource_id: getResourceFromPos($(event).position().top)};
				if (ui.originalPosition.left !== ui.position.left){
					// start value change
					data.date_start = getDateFromPos($(event).position().left);
				} else {
					// end value change
					data.date_end = getDateFromPos($(event).position().left + $(event).width());
				}
				if (linked !== undefined && linked !== null){
					event = linked.toArray().concat([event]);
				}
				on_resize(event, data);
			}
		}

		function eventDrag(ev, ui){
			var event = this;
			var linked = $(event).data('rv-drag_linked');
			if (linked !== undefined && linked !== null){
				linked.offset({left: $(event).offset().left});
				$(event).data('rv-drag_linked', null);
			}
			if (on_drag){
				var mid_height = (getResourceTop(t.resources[2].id) - getResourceTop(t.resources[1].id))/2.;
				var new_resource = getResourceFromPos($(event).position().top + mid_height);
				var old_resource = $.hasData(event) && parseInt($(event).data('rv-resource')) ?
								   $(event).data('rv-resource') :
								   getResourceFromPos(ui.originalPosition.top + mid_height);
				data = {
					resource_id: new_resource,
					old_resource: old_resource
				};
				if (ui.originalPosition.left !== ui.position.left){
					// start value change
					data.date_start = getDateFromPos($(event).position().left);
					data.date_end = getDateFromPos($(event).position().left + $(event).width());
				}
				if (linked !== undefined && linked !== null){
					event = linked.toArray().concat([event]);
				}
				$(event).data('rv-resource', new_resource);
				on_drag(event, data);
			}
		}

		function getDateFromPos(left_pos){
			var col = 1;
			var d1 = Math.pow(hcache.pos(col) - left_pos, 2);
			do{
				d0 = d1;
				col++;
				if (col > dates.length){
					col = dates.length + 1;
					break;
				}
				d1 = Math.pow(hcache.pos(col) - left_pos, 2);
			} while(d0 > d1);
			return dates[col-2];
		}

		function getDateCol(date){
			col = -1;
			$.each(dates, function(i, d){
				if (d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear()){
					col = i;
					return;
				}
			});
			return col;
		}

		function getResourceFromPos(top_pos){
			var resource_id = null;
			$.each(resource_rows, function(r_id, row){
				if (getResourceTop(r_id) > top_pos){
					return;
				}
				resource_id = r_id;
			});
			return resource_id;
		}

		function getEventCoordinates(event){
			var coordinates = {};
			var start_index = getDateCol(parseDate(event.date_start, event.id==26));
			var date_end = parseDate(event.date_end);
			if (event.inclusive === true){
				date_end.setDate(date_end.getDate()+1);
			}
			var end_index = getDateCol(date_end);
			if (start_index === -1){
				coordinates.left = leftEdge;
				coordinates.at_edge_left = true;
			} else {
				coordinates.left = hcache.pos(start_index+1);
				coordinates.at_edge_left = false;
			}
			if (end_index === -1){
				var right = rightEdge;
				coordinates.at_edge_right = true;
			} else{
				var right = hcache.pos(end_index+1);
				coordinates.at_edge_right = false;
			}
			coordinates.width = right - coordinates.left;
			coordinates.top = getResourceTop(event.resource_id);
			return coordinates;
		}

		function getResourceTop(resource_id){
			return vcache[resource_id] = vcache[resource_id] === undefined ? resource_rows[resource_id].position().top : vcache[resource_id];
		}

		function defaultEventRender(event){
			return event.display ? event.display : '';
		}

        function clearEvents(){
			event_container.html('');
        }

    }

	function HorizontalPositionCache(getElement) {
		var t = this,
			elements = {},
			mids = {};

		function e(i) {
			return elements[i] = elements[i] || getElement(i);
		}

		t.pos = function(i) {
			return mids[i] = mids[i] === undefined ? e(i).position().left : mids[i];
		};

		t.clear = function() {
			elements = {};
			mids = {};
		};
	}

})(jQuery);
